// Demo implementation of DataService that keeps everything in the browser.
// It enforces the same permission and validation rules a server would, so the
// screens behave exactly as they will once a real database is connected.
// It is NOT secure storage: anyone with access to this browser can read the data.

import { AppError } from '../../core/errors.ts';
import { can, isAdmin } from '../../core/permissions.ts';
import type {
  Activity,
  ActivityKind,
  AppNotification,
  Assessment,
  Client,
  Lead,
  LeadStatus,
  LookupItem,
  LookupKind,
  Lookups,
  MeetingMode,
  MeetingStatus,
  NotificationKind,
  Profile,
  Task,
} from '../../core/types.ts';
import { normalizePhone, validateNewPassword, Validator } from '../../core/validation.ts';
import type {
  ActivityInput,
  AssessmentInput,
  ClientDetailsInput,
  ClientFilter,
  CloseClientInput,
  ConvertLeadInput,
  DataService,
  Duplicate,
  EntryParent,
  FeedbackInput,
  LeadFilter,
  LeadInput,
  LookupItemInput,
  MeetingInput,
  NewClientInput,
  Session,
  StaffInput,
  TaskFilter,
  TaskInput,
  UpcomingMeeting,
} from '../DataService.ts';
import { generateTempPassword, hashPassword, verifyPassword } from './crypto.ts';
import { buildSeed, DEMO_ACCOUNTS, DEMO_PASSWORD } from './seed.ts';
import type { DbState, StoredSession, StoredUser } from './state.ts';
import type { BlobStore, KeyValueStore } from './storage.ts';

// Separate demo data set for the fundraising call-center wording.
const DB_KEY = 'crm.demo.db.v1.donations';
const SESSION_KEY = 'crm.demo.session';

export const SESSION_IDLE_MINUTES = 30;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 5;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

const ACTIVITY_KINDS: readonly ActivityKind[] = ['call', 'message', 'email', 'meeting', 'note'];
const MEETING_MODES: readonly MeetingMode[] = ['in_person', 'video', 'phone'];
const MEETING_STATUSES: readonly MeetingStatus[] = ['scheduled', 'done', 'canceled'];
const BADGE_COLORS = ['gray', 'blue', 'green', 'amber', 'red', 'purple'] as const;

export interface LocalDataServiceOptions {
  kv: KeyValueStore;
  blobs: BlobStore;
  now?: () => Date;
}

function toProfile(u: StoredUser): Profile {
  return {
    id: u.id,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    role: u.role,
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword,
    createdAt: u.createdAt,
  };
}

function matchesSearch(search: string | undefined, ...fields: (string | null)[]): boolean {
  const q = search?.trim().toLowerCase();
  if (!q) return true;
  const qDigits = q.replace(/\D/g, '');
  return fields.some((f) => {
    if (!f) return false;
    if (f.toLowerCase().includes(q)) return true;
    return qDigits.length >= 3 && f.replace(/\D/g, '').includes(qDigits);
  });
}

const byName = (a: { fullName: string }, b: { fullName: string }) => a.fullName.localeCompare(b.fullName, 'he');
const bySort = (a: LookupItem, b: LookupItem) => a.sortOrder - b.sortOrder;

export class LocalDataService implements DataService {
  readonly mode = 'demo' as const;

  private readonly kv: KeyValueStore;
  private readonly blobs: BlobStore;
  private readonly now: () => Date;
  private state!: DbState;
  private readonly listeners = new Set<() => void>();

  private constructor(opts: LocalDataServiceOptions) {
    this.kv = opts.kv;
    this.blobs = opts.blobs;
    this.now = opts.now ?? (() => new Date());
  }

  static async create(opts: LocalDataServiceOptions): Promise<LocalDataService> {
    const service = new LocalDataService(opts);
    const loaded = service.load();
    if (loaded) {
      service.state = loaded;
    } else {
      service.state = await buildSeed(service.now());
      service.persist();
    }
    return service;
  }

  // ------------------------------------------------------------------ internals

  private load(): DbState | null {
    const raw = this.kv.getItem(DB_KEY);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DbState;
      return parsed.version === 1 ? parsed : null;
    } catch {
      return null;
    }
  }

  private persist(): void {
    this.kv.setItem(DB_KEY, JSON.stringify(this.state));
  }

  /** Saves the current state; on failure restores the last saved state so nothing is half-written. */
  private commit(): void {
    try {
      this.persist();
    } catch {
      this.state = this.load() ?? this.state;
      throw new AppError('storage_full', 'אין מספיק מקום בדפדפן לשמירת המידע. מחקו קבצים מיותרים ונסו שוב.');
    }
    this.emit();
  }

  private emit(): void {
    this.listeners.forEach((l) => l());
  }

  /** Re-reads storage after another browser tab changed it. */
  reloadFromStorage(): void {
    const loaded = this.load();
    if (loaded) this.state = loaded;
    this.emit();
  }

  private nowIso(): string {
    return this.now().toISOString();
  }

  private today(): string {
    const d = this.now();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private readSession(): StoredSession | null {
    const raw = this.kv.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredSession;
    } catch {
      return null;
    }
  }

  private writeSession(userId: string): void {
    const expiresAt = new Date(this.now().getTime() + SESSION_IDLE_MINUTES * 60_000).toISOString();
    const session: StoredSession = { userId, expiresAt };
    this.kv.setItem(SESSION_KEY, JSON.stringify(session));
  }

  /** The signed-in, active user. Every call extends the idle timeout. */
  private me(): StoredUser {
    const session = this.readSession();
    if (!session || Date.parse(session.expiresAt) <= this.now().getTime()) {
      this.kv.removeItem(SESSION_KEY);
      throw new AppError('unauthenticated');
    }
    const user = this.state.users.find((u) => u.id === session.userId);
    if (!user) {
      this.kv.removeItem(SESSION_KEY);
      throw new AppError('unauthenticated');
    }
    if (!user.isActive) {
      this.kv.removeItem(SESSION_KEY);
      throw new AppError('account_disabled');
    }
    this.writeSession(user.id);
    return user;
  }

  private admin(): StoredUser {
    const user = this.me();
    if (!isAdmin(user)) throw new AppError('forbidden');
    return user;
  }

  private audit(actor: StoredUser | null, action: string, entity: string, entityId: string | null, summary: string): void {
    this.state.audit.unshift({
      id: crypto.randomUUID(),
      actorId: actor?.id ?? null,
      action,
      entity,
      entityId,
      summary,
      createdAt: this.nowIso(),
    });
    if (this.state.audit.length > 2000) this.state.audit.length = 2000;
  }

  private notify(userId: string, kind: NotificationKind, title: string, refs: { clientId?: string; taskId?: string }): void {
    this.state.notifications.unshift({
      id: crypto.randomUUID(),
      userId,
      kind,
      title,
      body: null,
      clientId: refs.clientId ?? null,
      taskId: refs.taskId ?? null,
      readAt: null,
      createdAt: this.nowIso(),
    });
  }

  private findClient(user: StoredUser, id: string): Client {
    const client = this.state.clients.find((c) => c.id === id);
    // Same answer whether it doesn't exist or isn't yours — don't reveal existence.
    if (!client || !can.viewClient(user, client)) throw new AppError('not_found');
    return client;
  }

  private editableClient(user: StoredUser, id: string): Client {
    const client = this.findClient(user, id);
    if (!can.editClientContent(user, client)) throw new AppError('forbidden');
    return client;
  }

  private findLead(id: string): Lead {
    const lead = this.state.leads.find((l) => l.id === id && l.archivedAt === null);
    if (!lead) throw new AppError('not_found');
    return lead;
  }

  private activeStaff(id: string, field: string, label: string): StoredUser {
    const user = this.state.users.find((u) => u.id === id && u.isActive);
    if (!user) throw new AppError('validation', undefined, { [field]: `יש לבחור ${label}` });
    return user;
  }

  private lookupList(kind: LookupKind): LookupItem[] {
    return this.state[kind];
  }

  private requireLookup(kind: LookupKind, id: string | null, field: string, label: string): void {
    if (id === null) return;
    if (!this.lookupList(kind).some((i) => i.id === id)) {
      throw new AppError('validation', undefined, { [field]: `יש לבחור ${label}` });
    }
  }

  private stageName(stageId: string | null): string {
    return this.state.clientStages.find((s) => s.id === stageId)?.name ?? 'ללא שלב';
  }

  private recordStageChange(actor: StoredUser, clientId: string, from: string | null, to: string | null): void {
    this.state.stageHistory.unshift({
      id: crypto.randomUUID(),
      clientId,
      fromStageId: from,
      toStageId: to,
      changedBy: actor.id,
      changedAt: this.nowIso(),
    });
  }

  /** Resolves a lead/client parent for writing. Leads are admin-only. */
  private writableParent(user: StoredUser, parent: EntryParent): { leadId: string | null; client: Client | null } {
    if ('leadId' in parent) {
      if (!isAdmin(user)) throw new AppError('forbidden');
      const lead = this.findLead(parent.leadId);
      return { leadId: lead.id, client: null };
    }
    return { leadId: null, client: this.editableClient(user, parent.clientId) };
  }

  private readableParent(user: StoredUser, parent: EntryParent): void {
    if ('leadId' in parent) {
      if (!isAdmin(user)) throw new AppError('forbidden');
      this.findLead(parent.leadId);
    } else {
      this.findClient(user, parent.clientId);
    }
  }

  /** Re-checks access to whatever an existing entry is attached to. */
  private writableEntry(user: StoredUser, entry: { leadId?: string | null; clientId?: string | null }): Client | null {
    if (entry.leadId) {
      if (!isAdmin(user)) throw new AppError('not_found');
      return null;
    }
    if (entry.clientId) return this.editableClient(user, entry.clientId);
    return null;
  }

  private validateContact(v: Validator, input: { fullName: string; phone: string; email: string }) {
    const fullName = v.text('fullName', input.fullName, 'שם מלא', 100, 2);
    const phone = v.phone('phone', input.phone);
    const email = v.email('email', input.email);
    if (!v.errors.phone && !v.errors.email && !phone && !email) {
      v.check(false, 'phone', 'יש למלא לפחות טלפון או מייל');
    }
    return { fullName, phone, email };
  }

  // ------------------------------------------------------------------ demo helpers

  demoAccounts() {
    return DEMO_ACCOUNTS.map((a) => ({ ...a, password: DEMO_PASSWORD }));
  }

  async resetDemoData(): Promise<void> {
    this.admin();
    this.state = await buildSeed(this.now());
    await this.blobs.clear();
    this.kv.removeItem(SESSION_KEY);
    this.commit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------------ session

  async getSession(): Promise<Session | null> {
    try {
      return { user: toProfile(this.me()) };
    } catch {
      return null;
    }
  }

  async signIn(email: string, password: string): Promise<Session> {
    const v = new Validator();
    const cleanEmail = v.email('email', email, true);
    v.check(typeof password === 'string' && password.length > 0, 'password', 'יש למלא סיסמה');
    v.done();

    const user = this.state.users.find((u) => u.email === cleanEmail);
    if (!user) throw new AppError('invalid_credentials');

    const nowMs = this.now().getTime();
    if (user.lockedUntil && Date.parse(user.lockedUntil) > nowMs) {
      const minutes = Math.ceil((Date.parse(user.lockedUntil) - nowMs) / 60_000);
      throw new AppError('forbidden', `בגלל כמה ניסיונות כניסה שגויים, הכניסה נחסמה זמנית. נסו שוב בעוד ${minutes} דקות.`);
    }

    if (!(await verifyPassword(password, user.passwordHash, user.passwordSalt))) {
      user.failedLogins += 1;
      if (user.failedLogins >= MAX_FAILED_LOGINS) {
        user.failedLogins = 0;
        user.lockedUntil = new Date(nowMs + LOCK_MINUTES * 60_000).toISOString();
        this.audit(null, 'login_locked', 'user', user.id, `הכניסה של ${user.fullName} נחסמה זמנית אחרי ניסיונות שגויים`);
      }
      this.commit();
      throw new AppError('invalid_credentials');
    }

    if (!user.isActive) throw new AppError('account_disabled');

    user.failedLogins = 0;
    user.lockedUntil = null;
    this.writeSession(user.id);
    this.audit(user, 'sign_in', 'user', user.id, `${user.fullName} נכנסה למערכת`);
    this.commit();
    return { user: toProfile(user) };
  }

  async signOut(): Promise<void> {
    this.kv.removeItem(SESSION_KEY);
    this.emit();
  }

  async changePassword(newPassword: string, confirm: string): Promise<void> {
    const user = this.me();
    const v = new Validator();
    const password = validateNewPassword(v, 'password', newPassword, confirm);
    v.done();
    const { hash, salt } = await hashPassword(password);
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.mustChangePassword = false;
    this.audit(user, 'password_changed', 'user', user.id, `${user.fullName} החליפה סיסמה`);
    this.commit();
  }

  async updateMyProfile(input: { fullName: string; phone: string }): Promise<void> {
    const user = this.me();
    const v = new Validator();
    const fullName = v.text('fullName', input.fullName, 'שם מלא', 100, 2);
    const phone = v.phone('phone', input.phone);
    v.done();
    user.fullName = fullName;
    user.phone = phone;
    this.commit();
  }

  // ------------------------------------------------------------------ staff

  async listStaff(): Promise<Profile[]> {
    this.me();
    return this.state.users.map(toProfile).sort(byName);
  }

  private validateStaff(input: StaffInput, excludeId: string | null) {
    const v = new Validator();
    const fullName = v.text('fullName', input.fullName, 'שם מלא', 100, 2);
    const email = v.email('email', input.email, true);
    const phone = v.phone('phone', input.phone);
    const role = v.oneOf('role', input.role, ['admin', 'counselor'] as const, 'תפקיד');
    if (email && this.state.users.some((u) => u.email === email && u.id !== excludeId)) {
      v.check(false, 'email', 'כבר קיים משתמש עם המייל הזה');
    }
    v.done();
    return { fullName, email: email!, phone, role };
  }

  async createStaff(input: StaffInput): Promise<{ profile: Profile; tempPassword: string }> {
    const actor = this.admin();
    const clean = this.validateStaff(input, null);
    const tempPassword = generateTempPassword();
    const { hash, salt } = await hashPassword(tempPassword);
    const user: StoredUser = {
      id: crypto.randomUUID(),
      ...clean,
      isActive: true,
      mustChangePassword: true,
      createdAt: this.nowIso(),
      passwordHash: hash,
      passwordSalt: salt,
      failedLogins: 0,
      lockedUntil: null,
    };
    this.state.users.push(user);
    this.audit(actor, 'staff_created', 'user', user.id, `נוצר משתמש עבור ${user.fullName}`);
    this.commit();
    return { profile: toProfile(user), tempPassword };
  }

  private activeAdminCount(): number {
    return this.state.users.filter((u) => u.isActive && u.role === 'admin').length;
  }

  async updateStaff(userId: string, input: StaffInput): Promise<void> {
    const actor = this.admin();
    const target = this.state.users.find((u) => u.id === userId);
    if (!target) throw new AppError('not_found');
    const clean = this.validateStaff(input, userId);
    if (clean.role !== target.role) {
      if (target.id === actor.id) {
        throw new AppError('forbidden', 'אי אפשר לשנות את התפקיד של עצמך. מנהלת אחרת יכולה לעשות זאת.');
      }
      if (target.role === 'admin' && target.isActive && this.activeAdminCount() <= 1) {
        throw new AppError('forbidden', 'חייבת להישאר לפחות מנהלת פעילה אחת במערכת.');
      }
    }
    const roleChanged = clean.role !== target.role;
    Object.assign(target, clean);
    this.audit(actor, roleChanged ? 'staff_role_changed' : 'staff_updated', 'user', target.id, `עודכנו פרטי ${target.fullName}`);
    this.commit();
  }

  async resetStaffPassword(userId: string): Promise<string> {
    const actor = this.admin();
    const target = this.state.users.find((u) => u.id === userId);
    if (!target) throw new AppError('not_found');
    if (target.id === actor.id) {
      throw new AppError('forbidden', 'כדי להחליף את הסיסמה שלך, היכנסי למסך "החשבון שלי".');
    }
    const tempPassword = generateTempPassword();
    const { hash, salt } = await hashPassword(tempPassword);
    target.passwordHash = hash;
    target.passwordSalt = salt;
    target.mustChangePassword = true;
    target.failedLogins = 0;
    target.lockedUntil = null;
    this.audit(actor, 'password_reset', 'user', target.id, `אופסה הסיסמה של ${target.fullName}`);
    this.commit();
    return tempPassword;
  }

  async setStaffActive(userId: string, active: boolean): Promise<void> {
    const actor = this.admin();
    const target = this.state.users.find((u) => u.id === userId);
    if (!target) throw new AppError('not_found');
    if (target.isActive === active) return;
    if (!active) {
      if (target.id === actor.id) throw new AppError('forbidden', 'אי אפשר להשבית את החשבון של עצמך.');
      if (target.role === 'admin' && this.activeAdminCount() <= 1) {
        throw new AppError('forbidden', 'חייבת להישאר לפחות מנהלת פעילה אחת במערכת.');
      }
    }
    target.isActive = active;
    this.audit(actor, active ? 'staff_enabled' : 'staff_disabled', 'user', target.id, `${target.fullName} ${active ? 'הופעלה מחדש' : 'הושבתה'}`);
    this.commit();
  }

  // ------------------------------------------------------------------ settings lists

  async getLookups(): Promise<Lookups> {
    this.me();
    return {
      leadSources: [...this.state.leadSources].sort(bySort),
      leadStatuses: [...this.state.leadStatuses].sort(bySort),
      clientStages: [...this.state.clientStages].sort(bySort),
    };
  }

  private validateLookup(kind: LookupKind, input: LookupItemInput, excludeId: string | null) {
    const v = new Validator();
    const name = v.text('name', input.name, 'שם', 60);
    if (name && this.lookupList(kind).some((i) => i.id !== excludeId && i.name.trim() === name)) {
      v.check(false, 'name', 'כבר קיים פריט בשם הזה');
    }
    let statusFields: Pick<LeadStatus, 'kind' | 'color'> | null = null;
    if (kind === 'leadStatuses') {
      statusFields = {
        kind: v.oneOf('kind', input.kind, ['open', 'lost'] as const, 'סוג'),
        color: v.oneOf('color', input.color, BADGE_COLORS, 'צבע'),
      };
    }
    v.done();
    return { name, statusFields };
  }

  async addLookupItem(kind: LookupKind, input: LookupItemInput): Promise<void> {
    const actor = this.admin();
    const { name, statusFields } = this.validateLookup(kind, input, null);
    const list = this.lookupList(kind);
    const sortOrder = list.reduce((m, i) => Math.max(m, i.sortOrder), 0) + 1;
    const item = { id: crypto.randomUUID(), name, sortOrder, isActive: true, ...statusFields };
    (list as LookupItem[]).push(item);
    this.audit(actor, 'setting_added', kind, item.id, `נוסף "${name}"`);
    this.commit();
  }

  async updateLookupItem(kind: LookupKind, id: string, input: LookupItemInput): Promise<void> {
    const actor = this.admin();
    const item = this.lookupList(kind).find((i) => i.id === id);
    if (!item) throw new AppError('not_found');
    const { name, statusFields } = this.validateLookup(kind, input, id);
    if (statusFields && (item as LeadStatus).kind === 'open' && statusFields.kind !== 'open') {
      this.ensureAnotherOpenStatus(id);
    }
    Object.assign(item, { name }, statusFields);
    this.audit(actor, 'setting_updated', kind, id, `עודכן "${name}"`);
    this.commit();
  }

  private ensureAnotherOpenStatus(exceptId: string): void {
    const others = this.state.leadStatuses.filter((s) => s.id !== exceptId && s.isActive && s.kind === 'open');
    if (others.length === 0) {
      throw new AppError('forbidden', 'חייב להישאר לפחות סטטוס פעיל אחד ללידים בטיפול.');
    }
  }

  async setLookupItemActive(kind: LookupKind, id: string, active: boolean): Promise<void> {
    const actor = this.admin();
    const item = this.lookupList(kind).find((i) => i.id === id);
    if (!item) throw new AppError('not_found');
    if (!active && kind === 'leadStatuses' && (item as LeadStatus).kind === 'open') {
      this.ensureAnotherOpenStatus(id);
    }
    item.isActive = active;
    this.audit(actor, active ? 'setting_shown' : 'setting_hidden', kind, id, `"${item.name}" ${active ? 'הוחזר לשימוש' : 'הוסתר'}`);
    this.commit();
  }

  async moveLookupItem(kind: LookupKind, id: string, direction: 'up' | 'down'): Promise<void> {
    this.admin();
    const sorted = [...this.lookupList(kind)].sort(bySort);
    const index = sorted.findIndex((i) => i.id === id);
    if (index < 0) throw new AppError('not_found');
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    sorted.forEach((item, i) => (item.sortOrder = i + 1));
    [sorted[index].sortOrder, sorted[swapWith].sortOrder] = [sorted[swapWith].sortOrder, sorted[index].sortOrder];
    this.commit();
  }

  // ------------------------------------------------------------------ leads

  async listLeads(filter: LeadFilter): Promise<Lead[]> {
    this.admin();
    const statusKind = new Map(this.state.leadStatuses.map((s) => [s.id, s.kind]));
    return this.state.leads
      .filter((l) => l.archivedAt === null)
      .filter((l) => {
        const converted = l.convertedClientId !== null;
        const kind = statusKind.get(l.statusId) ?? 'open';
        switch (filter.view) {
          case 'open':
            return !converted && kind === 'open';
          case 'converted':
            return converted;
          case 'lost':
            return !converted && kind === 'lost';
          default:
            return true;
        }
      })
      .filter((l) => matchesSearch(filter.search, l.fullName, l.phone, l.email))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getLead(id: string): Promise<Lead> {
    this.admin();
    return { ...this.findLead(id) };
  }

  private validateLead(input: LeadInput) {
    const v = new Validator();
    const contact = this.validateContact(v, input);
    const inquiry = v.optionalText('inquiry', input.inquiry, 'תיאור הפנייה', 4000);
    v.done();
    this.requireLookup('leadSources', input.sourceId || null, 'sourceId', 'מקור הגעה');
    if (input.statusId) this.requireLookup('leadStatuses', input.statusId, 'statusId', 'סטטוס');
    return { ...contact, inquiry, sourceId: input.sourceId || null };
  }

  async createLead(input: LeadInput): Promise<Lead> {
    const actor = this.admin();
    const clean = this.validateLead(input);
    const defaultStatus = [...this.state.leadStatuses].sort(bySort).find((s) => s.isActive && s.kind === 'open');
    const statusId = input.statusId || defaultStatus?.id;
    if (!statusId) throw new AppError('validation', 'לא הוגדר סטטוס פעיל ללידים. יש להוסיף אחד במסך ההגדרות.');
    const now = this.nowIso();
    const lead: Lead = {
      id: crypto.randomUUID(),
      ...clean,
      statusId,
      convertedClientId: null,
      convertedAt: null,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    this.state.leads.push(lead);
    this.audit(actor, 'lead_created', 'lead', lead.id, `נוסף ליד: ${lead.fullName}`);
    this.commit();
    return { ...lead };
  }

  async updateLead(id: string, input: LeadInput): Promise<void> {
    const actor = this.admin();
    const lead = this.findLead(id);
    const clean = this.validateLead(input);
    Object.assign(lead, clean, input.statusId ? { statusId: input.statusId } : {}, { updatedAt: this.nowIso() });
    this.audit(actor, 'lead_updated', 'lead', id, `עודכנו פרטי הליד ${lead.fullName}`);
    this.commit();
  }

  async setLeadStatus(id: string, statusId: string): Promise<void> {
    this.admin();
    const lead = this.findLead(id);
    if (lead.convertedClientId) throw new AppError('forbidden', 'הליד הזה כבר הפך לתורם, ולכן אי אפשר לשנות את הסטטוס שלו.');
    this.requireLookup('leadStatuses', statusId, 'statusId', 'סטטוס');
    lead.statusId = statusId;
    lead.updatedAt = this.nowIso();
    this.commit();
  }

  async archiveLead(id: string): Promise<void> {
    const actor = this.admin();
    const lead = this.findLead(id);
    lead.archivedAt = this.nowIso();
    this.audit(actor, 'lead_archived', 'lead', id, `הליד ${lead.fullName} הועבר לארכיון`);
    this.commit();
  }

  async convertLead(id: string, input: ConvertLeadInput): Promise<Client> {
    const actor = this.admin();
    const lead = this.findLead(id);
    if (lead.convertedClientId) throw new AppError('conflict', 'הליד הזה כבר הפך לתורם.');

    const v = new Validator();
    const note = v.optionalText('noteForCounselor', input.noteForCounselor, 'ההערה', 8000);
    v.check(Boolean(input.counselorId), 'counselorId', 'יש לבחור נציגה');
    v.done();
    const counselor = this.activeStaff(input.counselorId, 'counselorId', 'נציגה');
    const stageId = input.stageId ?? [...this.state.clientStages].sort(bySort).find((s) => s.isActive)?.id ?? null;
    this.requireLookup('clientStages', stageId, 'stageId', 'שלב');

    const now = this.nowIso();
    const client: Client = {
      id: crypto.randomUUID(),
      leadId: lead.id,
      fullName: lead.fullName,
      phone: lead.phone,
      email: lead.email,
      background: note,
      counselorId: counselor.id,
      stageId,
      status: 'active',
      startedAt: this.today(),
      endedAt: null,
      endReason: null,
      endSummary: null,
      feedbackRating: null,
      feedbackText: null,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    this.state.clients.push(client);
    lead.convertedClientId = client.id;
    lead.convertedAt = now;
    lead.updatedAt = now;
    this.recordStageChange(actor, client.id, null, stageId);
    if (counselor.id !== actor.id) {
      this.notify(counselor.id, 'client_assigned', `שויך אלייך תורם חדש: ${client.fullName}`, { clientId: client.id });
    }
    this.audit(actor, 'lead_converted', 'client', client.id, `${lead.fullName} הפך לתורם ושויך ל${counselor.fullName}`);
    this.commit();
    return { ...client };
  }

  async findDuplicates(phone: string, email: string, excludeLeadId?: string): Promise<Duplicate[]> {
    this.admin();
    const p = phone ? normalizePhone(phone) : null;
    const e = email?.trim().toLowerCase() || null;
    if (!p && !e) return [];
    const same = (x: { phone: string | null; email: string | null }) =>
      (p !== null && x.phone === p) || (e !== null && x.email === e);
    return [
      ...this.state.leads
        .filter((l) => l.archivedAt === null && l.id !== excludeLeadId && !l.convertedClientId && same(l))
        .map((l) => ({ type: 'lead' as const, id: l.id, fullName: l.fullName })),
      ...this.state.clients
        .filter((c) => c.archivedAt === null && same(c))
        .map((c) => ({ type: 'client' as const, id: c.id, fullName: c.fullName })),
    ];
  }

  // ------------------------------------------------------------------ clients

  async listClients(filter: ClientFilter): Promise<Client[]> {
    const user = this.me();
    const admin = isAdmin(user);
    return this.state.clients
      .filter((c) => can.viewClient(user, c))
      .filter((c) => (filter.includeArchived && admin ? true : c.archivedAt === null))
      .filter((c) => (filter.status === 'active' ? c.status === 'active' : filter.status === 'ended' ? c.status !== 'active' : true))
      .filter((c) => !admin || !filter.counselorId || c.counselorId === filter.counselorId)
      .filter((c) => matchesSearch(filter.search, c.fullName, c.phone, c.email))
      .sort(byName)
      .map((c) => ({ ...c }));
  }

  async getClient(id: string): Promise<Client> {
    return { ...this.findClient(this.me(), id) };
  }

  async createClient(input: NewClientInput): Promise<Client> {
    const actor = this.admin();
    const v = new Validator();
    const contact = this.validateContact(v, input);
    const background = v.optionalText('background', input.background, 'רקע', 8000);
    v.check(Boolean(input.counselorId), 'counselorId', 'יש לבחור נציגה');
    v.done();
    const counselor = this.activeStaff(input.counselorId, 'counselorId', 'נציגה');
    this.requireLookup('clientStages', input.stageId, 'stageId', 'שלב');
    const now = this.nowIso();
    const client: Client = {
      id: crypto.randomUUID(),
      leadId: null,
      ...contact,
      background,
      counselorId: counselor.id,
      stageId: input.stageId,
      status: 'active',
      startedAt: this.today(),
      endedAt: null,
      endReason: null,
      endSummary: null,
      feedbackRating: null,
      feedbackText: null,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    };
    this.state.clients.push(client);
    this.recordStageChange(actor, client.id, null, client.stageId);
    if (counselor.id !== actor.id) {
      this.notify(counselor.id, 'client_assigned', `שויך אלייך תורם חדש: ${client.fullName}`, { clientId: client.id });
    }
    this.audit(actor, 'client_created', 'client', client.id, `נוסף תורם: ${client.fullName}`);
    this.commit();
    return { ...client };
  }

  async updateClientDetails(id: string, input: ClientDetailsInput): Promise<void> {
    const user = this.me();
    const client = this.editableClient(user, id);
    const v = new Validator();
    const contact = this.validateContact(v, input);
    const background = v.optionalText('background', input.background, 'רקע', 8000);
    v.done();
    Object.assign(client, contact, { background, updatedAt: this.nowIso() });
    this.audit(user, 'client_updated', 'client', id, `עודכנו פרטי ${client.fullName}`);
    this.commit();
  }

  async setClientStage(id: string, stageId: string | null): Promise<void> {
    const user = this.me();
    const client = this.editableClient(user, id);
    this.requireLookup('clientStages', stageId, 'stageId', 'שלב');
    if (client.stageId === stageId) return;
    this.recordStageChange(user, id, client.stageId, stageId);
    this.audit(user, 'client_stage_changed', 'client', id, `${client.fullName}: ${this.stageName(client.stageId)} ← ${this.stageName(stageId)}`);
    client.stageId = stageId;
    client.updatedAt = this.nowIso();
    this.commit();
  }

  async assignClient(id: string, counselorId: string): Promise<void> {
    const actor = this.admin();
    const client = this.findClient(actor, id);
    const counselor = this.activeStaff(counselorId, 'counselorId', 'נציגה');
    if (client.counselorId === counselor.id) return;
    const previous = this.state.users.find((u) => u.id === client.counselorId);
    client.counselorId = counselor.id;
    client.updatedAt = this.nowIso();
    if (counselor.id !== actor.id) {
      this.notify(counselor.id, 'client_assigned', `שויך אלייך תורם: ${client.fullName}`, { clientId: client.id });
    }
    this.audit(actor, 'client_assigned', 'client', id, `${client.fullName} הועבר מ${previous?.fullName ?? '—'} ל${counselor.fullName}`);
    this.commit();
  }

  async closeClient(id: string, input: CloseClientInput): Promise<void> {
    const user = this.me();
    const client = this.editableClient(user, id);
    if (client.status !== 'active') throw new AppError('conflict', 'הקשר עם התורם כבר הסתיים.');
    const v = new Validator();
    const status = v.oneOf('status', input.status, ['completed', 'stopped'] as const, 'אופן הסיום');
    const endedAt = v.date('endedAt', input.endedAt, 'תאריך סיום', true);
    const endReason = v.optionalText('endReason', input.endReason, 'סיבת הסיום', 500);
    const endSummary = v.optionalText('endSummary', input.endSummary, 'סיכום', 8000);
    if (endedAt) v.check(endedAt >= client.startedAt, 'endedAt', 'תאריך הסיום לא יכול להיות לפני תחילת הקשר');
    v.done();
    Object.assign(client, { status, endedAt, endReason, endSummary, updatedAt: this.nowIso() });
    this.audit(user, 'client_closed', 'client', id, `הקשר עם ${client.fullName} ${status === 'completed' ? 'הסתיים' : 'הופסק'}`);
    this.commit();
  }

  async reopenClient(id: string): Promise<void> {
    const user = this.me();
    const client = this.editableClient(user, id);
    if (client.status === 'active') return;
    // The previous end summary and reason are kept, so nothing written is lost.
    client.status = 'active';
    client.endedAt = null;
    client.updatedAt = this.nowIso();
    this.audit(user, 'client_reopened', 'client', id, `הקשר עם ${client.fullName} נפתח מחדש`);
    this.commit();
  }

  async saveFeedback(id: string, input: FeedbackInput): Promise<void> {
    const user = this.me();
    const client = this.editableClient(user, id);
    const v = new Validator();
    const rating = input.rating === null ? null : v.int('rating', input.rating, 'הדירוג', 1, 5);
    const text = v.optionalText('text', input.text, 'המשוב', 4000);
    v.done();
    client.feedbackRating = rating;
    client.feedbackText = text;
    client.updatedAt = this.nowIso();
    this.commit();
  }

  async archiveClient(id: string): Promise<void> {
    const actor = this.admin();
    const client = this.findClient(actor, id);
    client.archivedAt = this.nowIso();
    this.audit(actor, 'client_archived', 'client', id, `${client.fullName} הועבר לארכיון`);
    this.commit();
  }

  async restoreClient(id: string): Promise<void> {
    const actor = this.admin();
    const client = this.findClient(actor, id);
    client.archivedAt = null;
    this.audit(actor, 'client_restored', 'client', id, `${client.fullName} הוחזר מהארכיון`);
    this.commit();
  }

  async listStageHistory(clientId: string) {
    this.findClient(this.me(), clientId);
    return this.state.stageHistory.filter((h) => h.clientId === clientId).map((h) => ({ ...h }));
  }

  // ------------------------------------------------------------------ activities

  async listActivities(parent: EntryParent): Promise<Activity[]> {
    const user = this.me();
    this.readableParent(user, parent);
    const key = 'leadId' in parent ? { leadId: parent.leadId } : { clientId: parent.clientId };
    return this.state.activities
      .filter((a) => ('leadId' in key ? a.leadId === key.leadId : a.clientId === key.clientId))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .map((a) => ({ ...a }));
  }

  private validateActivity(input: ActivityInput) {
    const v = new Validator();
    const kind = v.oneOf('kind', input.kind, ACTIVITY_KINDS, 'סוג');
    const content = v.text('content', input.content, 'תוכן', 8000);
    const occurredAt = v.dateTime('occurredAt', input.occurredAt, 'מועד');
    v.done();
    return { kind, content, occurredAt };
  }

  async addActivity(parent: EntryParent, input: ActivityInput): Promise<void> {
    const user = this.me();
    const { leadId, client } = this.writableParent(user, parent);
    const clean = this.validateActivity(input);
    const now = this.nowIso();
    this.state.activities.push({
      id: crypto.randomUUID(),
      leadId,
      clientId: client?.id ?? null,
      ...clean,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });
    this.commit();
  }

  private findActivity(user: StoredUser, id: string): Activity {
    const activity = this.state.activities.find((a) => a.id === id);
    if (!activity) throw new AppError('not_found');
    this.writableEntry(user, activity);
    if (!can.modifyEntry(user, activity)) throw new AppError('forbidden', 'אפשר לערוך רק רישומים שכתבת בעצמך.');
    return activity;
  }

  async updateActivity(id: string, input: ActivityInput): Promise<void> {
    const user = this.me();
    const activity = this.findActivity(user, id);
    Object.assign(activity, this.validateActivity(input), { updatedAt: this.nowIso() });
    this.commit();
  }

  async deleteActivity(id: string): Promise<void> {
    const user = this.me();
    const activity = this.findActivity(user, id);
    this.state.activities = this.state.activities.filter((a) => a.id !== id);
    this.audit(user, 'activity_deleted', 'activity', id, `נמחק רישום: ${activity.content.slice(0, 80)}`);
    this.commit();
  }

  // ------------------------------------------------------------------ tasks

  private linkedClient(task: Task): Client | null {
    return task.clientId ? this.state.clients.find((c) => c.id === task.clientId) ?? null : null;
  }

  async listTasks(filter: TaskFilter): Promise<Task[]> {
    const user = this.me();
    const admin = isAdmin(user);
    let tasks: Task[];
    if (filter.leadId) {
      if (!admin) throw new AppError('forbidden');
      tasks = this.state.tasks.filter((t) => t.leadId === filter.leadId);
    } else if (filter.clientId) {
      this.findClient(user, filter.clientId);
      tasks = this.state.tasks.filter((t) => t.clientId === filter.clientId);
    } else {
      const assignee = filter.assigneeId ?? user.id;
      if (assignee !== user.id && !admin) throw new AppError('forbidden');
      tasks = assignee === 'all' ? this.state.tasks : this.state.tasks.filter((t) => t.assigneeId === assignee);
    }
    return tasks
      .filter((t) => can.viewTask(user, t, this.linkedClient(t)))
      .sort((a, b) => {
        if (!a.completedAt !== !b.completedAt) return a.completedAt ? 1 : -1;
        if (a.completedAt && b.completedAt) return b.completedAt.localeCompare(a.completedAt);
        return (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
      })
      .map((t) => ({ ...t }));
  }

  private validateTask(user: StoredUser, input: TaskInput, leadId: string | null, client: Client | null) {
    const v = new Validator();
    const title = v.text('title', input.title, 'תיאור המשימה', 200);
    const dueDate = v.date('dueDate', input.dueDate, 'תאריך');
    v.done();
    const assigneeId = input.assigneeId || user.id;
    if (assigneeId !== user.id && !isAdmin(user)) {
      throw new AppError('forbidden', 'אפשר ליצור משימות רק עבור עצמך.');
    }
    const assignee = this.activeStaff(assigneeId, 'assigneeId', 'למי המשימה');
    if (leadId && assignee.role !== 'admin') {
      throw new AppError('validation', undefined, { assigneeId: 'משימות של לידים יכולות להיות רק של מנהלת' });
    }
    if (client && assignee.role !== 'admin' && assignee.id !== client.counselorId) {
      throw new AppError('validation', undefined, { assigneeId: 'אפשר לשייך משימה רק לנציגה של התורם או למנהלת' });
    }
    return { title, dueDate, assignee };
  }

  async addTask(parent: EntryParent | null, input: TaskInput): Promise<void> {
    const user = this.me();
    const { leadId, client } = parent ? this.writableParent(user, parent) : { leadId: null, client: null };
    const { title, dueDate, assignee } = this.validateTask(user, input, leadId, client);
    const now = this.nowIso();
    const task: Task = {
      id: crypto.randomUUID(),
      leadId,
      clientId: client?.id ?? null,
      title,
      dueDate,
      assigneeId: assignee.id,
      completedAt: null,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };
    this.state.tasks.push(task);
    if (assignee.id !== user.id) {
      this.notify(assignee.id, 'task_assigned', `משימה חדשה עבורך: ${title}`, { clientId: client?.id, taskId: task.id });
    }
    this.commit();
  }

  private findVisibleTask(user: StoredUser, id: string): Task {
    const task = this.state.tasks.find((t) => t.id === id);
    if (!task || !can.viewTask(user, task, this.linkedClient(task))) throw new AppError('not_found');
    return task;
  }

  async updateTask(id: string, input: TaskInput): Promise<void> {
    const user = this.me();
    const task = this.findVisibleTask(user, id);
    if (!can.modifyEntry(user, task)) throw new AppError('forbidden', 'אפשר לערוך רק משימות שיצרת בעצמך.');
    const client = this.linkedClient(task);
    const { title, dueDate, assignee } = this.validateTask(user, { ...input, assigneeId: input.assigneeId || task.assigneeId }, task.leadId, client);
    const reassigned = assignee.id !== task.assigneeId;
    Object.assign(task, { title, dueDate, assigneeId: assignee.id, updatedAt: this.nowIso() });
    if (reassigned && assignee.id !== user.id) {
      this.notify(assignee.id, 'task_assigned', `משימה חדשה עבורך: ${title}`, { clientId: client?.id, taskId: task.id });
    }
    this.commit();
  }

  async setTaskDone(id: string, done: boolean): Promise<void> {
    const user = this.me();
    const task = this.findVisibleTask(user, id);
    task.completedAt = done ? this.nowIso() : null;
    task.updatedAt = this.nowIso();
    this.commit();
  }

  async deleteTask(id: string): Promise<void> {
    const user = this.me();
    const task = this.findVisibleTask(user, id);
    if (!can.modifyEntry(user, task)) throw new AppError('forbidden', 'אפשר למחוק רק משימות שיצרת בעצמך.');
    this.state.tasks = this.state.tasks.filter((t) => t.id !== id);
    this.audit(user, 'task_deleted', 'task', id, `נמחקה משימה: ${task.title}`);
    this.commit();
  }

  // ------------------------------------------------------------------ meetings

  async listMeetings(clientId: string) {
    this.findClient(this.me(), clientId);
    return this.state.meetings
      .filter((m) => m.clientId === clientId)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .map((m) => ({ ...m }));
  }

  async listUpcomingMeetings(days: number): Promise<UpcomingMeeting[]> {
    const user = this.me();
    const start = new Date(this.now());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + (days + 1) * 86_400_000);
    const visible = new Map(
      this.state.clients.filter((c) => c.archivedAt === null && can.viewClient(user, c)).map((c) => [c.id, c]),
    );
    return this.state.meetings
      .filter((m) => m.status === 'scheduled' && visible.has(m.clientId))
      .filter((m) => {
        const t = Date.parse(m.startsAt);
        return t >= start.getTime() && t < end.getTime();
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((m) => ({ ...m, clientName: visible.get(m.clientId)!.fullName }));
  }

  private validateMeeting(input: MeetingInput) {
    const v = new Validator();
    const startsAt = v.dateTime('startsAt', input.startsAt, 'מועד השיחה');
    const durationMinutes = v.int('durationMinutes', input.durationMinutes, 'משך השיחה', 5, 600);
    const mode = v.oneOf('mode', input.mode, MEETING_MODES, 'סוג השיחה');
    const status = v.oneOf('status', input.status, MEETING_STATUSES, 'מצב השיחה');
    const summary = v.optionalText('summary', input.summary, 'הסיכום', 20000);
    v.done();
    return { startsAt, durationMinutes, mode, status, summary };
  }

  async addMeeting(clientId: string, input: MeetingInput): Promise<void> {
    const user = this.me();
    const client = this.editableClient(user, clientId);
    const now = this.nowIso();
    this.state.meetings.push({
      id: crypto.randomUUID(),
      clientId: client.id,
      ...this.validateMeeting(input),
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    });
    this.commit();
  }

  private findMeeting(user: StoredUser, id: string) {
    const meeting = this.state.meetings.find((m) => m.id === id);
    if (!meeting) throw new AppError('not_found');
    this.editableClient(user, meeting.clientId);
    return meeting;
  }

  async updateMeeting(id: string, input: MeetingInput): Promise<void> {
    const user = this.me();
    // Anyone working with the client may update a meeting (e.g. add the summary).
    const meeting = this.findMeeting(user, id);
    Object.assign(meeting, this.validateMeeting(input), { updatedAt: this.nowIso() });
    this.commit();
  }

  async deleteMeeting(id: string): Promise<void> {
    const user = this.me();
    const meeting = this.findMeeting(user, id);
    if (!can.modifyEntry(user, meeting)) throw new AppError('forbidden', 'אפשר למחוק רק שיחות שתיאמת בעצמך.');
    this.state.meetings = this.state.meetings.filter((m) => m.id !== id);
    this.audit(user, 'meeting_deleted', 'meeting', id, `נמחקה שיחה מתאריך ${meeting.startsAt.slice(0, 10)}`);
    this.commit();
  }

  // ------------------------------------------------------------------ assessments & files

  async listAssessments(clientId: string): Promise<Assessment[]> {
    this.findClient(this.me(), clientId);
    return this.state.assessments
      .filter((a) => a.clientId === clientId)
      .sort((a, b) => (b.assessedOn ?? b.createdAt).localeCompare(a.assessedOn ?? a.createdAt))
      .map((a) => ({ ...a }));
  }

  private validateAssessment(input: AssessmentInput) {
    const v = new Validator();
    const title = v.text('title', input.title, 'תיאור התרומה', 150);
    const assessedOn = v.date('assessedOn', input.assessedOn, 'תאריך');
    const findings = v.optionalText('findings', input.findings, 'הממצאים', 20000);
    v.done();
    return { title, assessedOn, findings };
  }

  async addAssessment(clientId: string, input: AssessmentInput): Promise<Assessment> {
    const user = this.me();
    const client = this.editableClient(user, clientId);
    const now = this.nowIso();
    const assessment: Assessment = {
      id: crypto.randomUUID(),
      clientId: client.id,
      ...this.validateAssessment(input),
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };
    this.state.assessments.push(assessment);
    this.commit();
    return { ...assessment };
  }

  private findAssessment(user: StoredUser, id: string, forWrite: boolean): Assessment {
    const assessment = this.state.assessments.find((a) => a.id === id);
    if (!assessment) throw new AppError('not_found');
    if (forWrite) this.editableClient(user, assessment.clientId);
    else this.findClient(user, assessment.clientId);
    return assessment;
  }

  async updateAssessment(id: string, input: AssessmentInput): Promise<void> {
    const user = this.me();
    const assessment = this.findAssessment(user, id, true);
    Object.assign(assessment, this.validateAssessment(input), { updatedAt: this.nowIso() });
    this.commit();
  }

  async deleteAssessment(id: string): Promise<void> {
    const user = this.me();
    const assessment = this.findAssessment(user, id, true);
    if (!can.modifyEntry(user, assessment)) throw new AppError('forbidden', 'אפשר למחוק רק תרומות שרשמת בעצמך.');
    const fileIds = this.state.files.filter((f) => f.assessmentId === id).map((f) => f.id);
    this.state.files = this.state.files.filter((f) => f.assessmentId !== id);
    this.state.assessments = this.state.assessments.filter((a) => a.id !== id);
    this.audit(user, 'assessment_deleted', 'assessment', id, `נמחקה תרומה: ${assessment.title} (${fileIds.length} קבצים)`);
    this.commit();
    await Promise.all(fileIds.map((f) => this.blobs.delete(f)));
  }

  async listFiles(assessmentId: string) {
    this.findAssessment(this.me(), assessmentId, false);
    return this.state.files
      .filter((f) => f.assessmentId === assessmentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((f) => ({ ...f }));
  }

  async uploadFile(assessmentId: string, file: File): Promise<void> {
    const user = this.me();
    const assessment = this.findAssessment(user, assessmentId, true);
    if (file.size > MAX_FILE_BYTES) {
      throw new AppError('validation', `הקובץ גדול מדי. הגודל המרבי הוא ${MAX_FILE_BYTES / 1024 / 1024} מגה.`);
    }
    if (file.size === 0) throw new AppError('validation', 'הקובץ ריק.');
    if (!ALLOWED_FILE_TYPES.includes(file.type)) {
      throw new AppError('validation', 'סוג הקובץ לא נתמך. אפשר לצרף מסמך, תמונה, PDF או גיליון.');
    }
    const id = crypto.randomUUID();
    await this.blobs.put(id, file);
    try {
      this.state.files.push({
        id,
        assessmentId,
        clientId: assessment.clientId,
        fileName: file.name.slice(0, 200) || 'קובץ',
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedBy: user.id,
        createdAt: this.nowIso(),
      });
      this.commit();
    } catch (err) {
      await this.blobs.delete(id);
      throw err;
    }
  }

  async downloadFile(fileId: string) {
    const user = this.me();
    const meta = this.state.files.find((f) => f.id === fileId);
    if (!meta) throw new AppError('not_found');
    this.findClient(user, meta.clientId);
    const blob = await this.blobs.get(fileId);
    if (!blob) throw new AppError('not_found', 'הקובץ לא נמצא בדפדפן הזה.');
    return { blob, fileName: meta.fileName };
  }

  async deleteFile(fileId: string): Promise<void> {
    const user = this.me();
    const meta = this.state.files.find((f) => f.id === fileId);
    if (!meta) throw new AppError('not_found');
    this.editableClient(user, meta.clientId);
    if (!can.modifyEntry(user, { createdBy: meta.uploadedBy })) {
      throw new AppError('forbidden', 'אפשר למחוק רק קבצים שהעלית בעצמך.');
    }
    this.state.files = this.state.files.filter((f) => f.id !== fileId);
    this.audit(user, 'file_deleted', 'file', fileId, `נמחק קובץ: ${meta.fileName}`);
    this.commit();
    await this.blobs.delete(fileId);
  }

  // ------------------------------------------------------------------ notifications & audit

  async listNotifications(): Promise<AppNotification[]> {
    const user = this.me();
    return this.state.notifications
      .filter((n) => n.userId === user.id)
      .slice(0, 100)
      .map((n) => ({ ...n }));
  }

  async markNotificationRead(id: string): Promise<void> {
    const user = this.me();
    const n = this.state.notifications.find((x) => x.id === id && x.userId === user.id);
    if (!n) throw new AppError('not_found');
    if (n.readAt) return;
    n.readAt = this.nowIso();
    this.commit();
  }

  async markAllNotificationsRead(): Promise<void> {
    const user = this.me();
    const now = this.nowIso();
    this.state.notifications.forEach((n) => {
      if (n.userId === user.id && !n.readAt) n.readAt = now;
    });
    this.commit();
  }

  async listAudit(limit: number) {
    this.admin();
    return this.state.audit.slice(0, Math.max(1, Math.min(limit, 500))).map((a) => ({ ...a }));
  }
}
