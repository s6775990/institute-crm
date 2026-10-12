// The contract between the screens and the data store.
// Screens never touch storage directly. Today it is implemented by
// LocalDataService (browser storage, demo only); a database-backed
// implementation will implement the same interface.
//
// Every method acts as the signed-in user and must enforce permissions
// and validation itself — the UI is never trusted.

import type {
  Activity,
  ActivityKind,
  AppNotification,
  Assessment,
  AttachedFile,
  AuditEntry,
  Client,
  ClientStatus,
  DateOnly,
  Lead,
  LeadStatus,
  LookupKind,
  Lookups,
  Meeting,
  MeetingMode,
  MeetingStatus,
  Profile,
  Role,
  StageChange,
  Task,
} from '../core/types.ts';

export interface LeadInput {
  fullName: string;
  phone: string;
  email: string;
  sourceId: string | null;
  statusId?: string;
  inquiry: string;
}

export interface LeadFilter {
  view: 'open' | 'converted' | 'lost' | 'all';
  search?: string;
}

export interface ConvertLeadInput {
  counselorId: string;
  stageId: string | null;
  noteForCounselor: string;
}

export interface ClientDetailsInput {
  fullName: string;
  phone: string;
  email: string;
  background: string;
}

export interface NewClientInput extends ClientDetailsInput {
  counselorId: string;
  stageId: string | null;
}

export interface ClientFilter {
  status: 'active' | 'ended' | 'all';
  counselorId?: string;
  search?: string;
  includeArchived?: boolean;
}

export interface CloseClientInput {
  status: Exclude<ClientStatus, 'active'>;
  endedAt: DateOnly;
  endReason: string;
  endSummary: string;
}

export interface FeedbackInput {
  rating: number | null;
  text: string;
}

export interface ActivityInput {
  kind: ActivityKind;
  content: string;
  occurredAt: string;
}

export type EntryParent = { leadId: string } | { clientId: string };

export interface TaskInput {
  title: string;
  dueDate: string;
  assigneeId?: string;
}

export interface TaskFilter {
  leadId?: string;
  clientId?: string;
  /** Admin only: tasks of a specific staff member. Default: the current user's. */
  assigneeId?: string | 'all';
}

export interface MeetingInput {
  startsAt: string;
  durationMinutes: number;
  mode: MeetingMode;
  status: MeetingStatus;
  summary: string;
}

export interface AssessmentInput {
  title: string;
  assessedOn: string;
  findings: string;
}

export interface StaffInput {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
}

export interface LookupItemInput {
  name: string;
  kind?: LeadStatus['kind'];
  color?: LeadStatus['color'];
}

export interface Duplicate {
  type: 'lead' | 'client';
  id: string;
  fullName: string;
}

export interface Session {
  user: Profile;
}

export interface UpcomingMeeting extends Meeting {
  clientName: string;
}

export interface DataService {
  readonly mode: 'demo' | 'live';

  // ---- Session ----
  getSession(): Promise<Session | null>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
  changePassword(newPassword: string, confirm: string): Promise<void>;
  updateMyProfile(input: { fullName: string; phone: string }): Promise<void>;

  // ---- Staff ----
  /** Basic details of all staff (for names and pickers). */
  listStaff(): Promise<Profile[]>;
  createStaff(input: StaffInput): Promise<{ profile: Profile; tempPassword: string }>;
  updateStaff(userId: string, input: StaffInput): Promise<void>;
  resetStaffPassword(userId: string): Promise<string>;
  setStaffActive(userId: string, active: boolean): Promise<void>;

  // ---- Settings lists ----
  getLookups(): Promise<Lookups>;
  addLookupItem(kind: LookupKind, input: LookupItemInput): Promise<void>;
  updateLookupItem(kind: LookupKind, id: string, input: LookupItemInput): Promise<void>;
  setLookupItemActive(kind: LookupKind, id: string, active: boolean): Promise<void>;
  moveLookupItem(kind: LookupKind, id: string, direction: 'up' | 'down'): Promise<void>;

  // ---- Leads (admin) ----
  listLeads(filter: LeadFilter): Promise<Lead[]>;
  getLead(id: string): Promise<Lead>;
  createLead(input: LeadInput): Promise<Lead>;
  updateLead(id: string, input: LeadInput): Promise<void>;
  setLeadStatus(id: string, statusId: string): Promise<void>;
  archiveLead(id: string): Promise<void>;
  convertLead(id: string, input: ConvertLeadInput): Promise<Client>;
  findDuplicates(phone: string, email: string, excludeLeadId?: string): Promise<Duplicate[]>;

  // ---- Clients ----
  listClients(filter: ClientFilter): Promise<Client[]>;
  getClient(id: string): Promise<Client>;
  createClient(input: NewClientInput): Promise<Client>;
  updateClientDetails(id: string, input: ClientDetailsInput): Promise<void>;
  setClientStage(id: string, stageId: string | null): Promise<void>;
  assignClient(id: string, counselorId: string): Promise<void>;
  closeClient(id: string, input: CloseClientInput): Promise<void>;
  reopenClient(id: string): Promise<void>;
  saveFeedback(id: string, input: FeedbackInput): Promise<void>;
  archiveClient(id: string): Promise<void>;
  restoreClient(id: string): Promise<void>;
  listStageHistory(clientId: string): Promise<StageChange[]>;

  // ---- Activity log (calls, messages, notes) ----
  listActivities(parent: EntryParent): Promise<Activity[]>;
  addActivity(parent: EntryParent, input: ActivityInput): Promise<void>;
  updateActivity(id: string, input: ActivityInput): Promise<void>;
  deleteActivity(id: string): Promise<void>;

  // ---- Tasks and follow-ups ----
  listTasks(filter: TaskFilter): Promise<Task[]>;
  addTask(parent: EntryParent | null, input: TaskInput): Promise<void>;
  updateTask(id: string, input: TaskInput): Promise<void>;
  setTaskDone(id: string, done: boolean): Promise<void>;
  deleteTask(id: string): Promise<void>;

  // ---- Meetings ----
  listMeetings(clientId: string): Promise<Meeting[]>;
  listUpcomingMeetings(days: number): Promise<UpcomingMeeting[]>;
  addMeeting(clientId: string, input: MeetingInput): Promise<void>;
  updateMeeting(id: string, input: MeetingInput): Promise<void>;
  deleteMeeting(id: string): Promise<void>;

  // ---- Assessments and files ----
  listAssessments(clientId: string): Promise<Assessment[]>;
  addAssessment(clientId: string, input: AssessmentInput): Promise<Assessment>;
  updateAssessment(id: string, input: AssessmentInput): Promise<void>;
  deleteAssessment(id: string): Promise<void>;
  listFiles(assessmentId: string): Promise<AttachedFile[]>;
  uploadFile(assessmentId: string, file: File): Promise<void>;
  downloadFile(fileId: string): Promise<{ blob: Blob; fileName: string }>;
  deleteFile(fileId: string): Promise<void>;

  // ---- Notifications ----
  listNotifications(): Promise<AppNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(): Promise<void>;

  // ---- Audit ----
  listAudit(limit: number): Promise<AuditEntry[]>;

  /** Called when data may have changed elsewhere (e.g. another tab). */
  subscribe(listener: () => void): () => void;
}
