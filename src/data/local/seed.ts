// Demo data so every screen has something to show. Names are fictional.

import type { LeadStatus, LookupItem } from '../../core/types.ts';
import { hashPassword } from './crypto.ts';
import type { DbState, StoredUser } from './state.ts';

export const DEMO_PASSWORD = '12345678';

export const DEMO_ACCOUNTS = [
  { email: 'manager@demo.co.il', label: 'רחל לוי – מנהלת המכון' },
  { email: 'michal@demo.co.il', label: 'מיכל כהן – יועצת' },
  { email: 'noa@demo.co.il', label: 'נועה פרץ – יועצת' },
] as const;

const id = () => crypto.randomUUID();

function lookup(names: string[]): LookupItem[] {
  return names.map((name, i) => ({ id: id(), name, sortOrder: i + 1, isActive: true }));
}

export async function buildSeed(now: Date): Promise<DbState> {
  const iso = (daysFromNow: number, hour = 10) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysFromNow);
    d.setHours(hour, 0, 0, 0);
    return d.toISOString();
  };
  const day = (daysFromNow: number) => iso(daysFromNow, 12).slice(0, 10);

  const { hash, salt } = await hashPassword(DEMO_PASSWORD);
  const user = (fullName: string, email: string, role: StoredUser['role'], phone: string): StoredUser => ({
    id: id(),
    fullName,
    email,
    phone,
    role,
    isActive: true,
    mustChangePassword: false,
    createdAt: iso(-90),
    passwordHash: hash,
    passwordSalt: salt,
    failedLogins: 0,
    lockedUntil: null,
  });

  const manager = user('רחל לוי', DEMO_ACCOUNTS[0].email, 'admin', '0501111111');
  const michal = user('מיכל כהן', DEMO_ACCOUNTS[1].email, 'counselor', '0502222222');
  const noa = user('נועה פרץ', DEMO_ACCOUNTS[2].email, 'counselor', '0503333333');

  const leadSources = lookup(['אתר האינטרנט', 'פייסבוק', 'אינסטגרם', 'המלצה מחברה', 'גוגל', 'אחר']);
  const statusDefs: [string, LeadStatus['kind'], LeadStatus['color']][] = [
    ['חדש', 'open', 'blue'],
    ['ניסינו ליצור קשר', 'open', 'amber'],
    ['בתהליך שיחה', 'open', 'purple'],
    ['ממתינה להחלטה', 'open', 'amber'],
    ['לא רלוונטי', 'lost', 'gray'],
  ];
  const leadStatuses: LeadStatus[] = statusDefs.map(([name, kind, color], i) => ({
    id: id(),
    name,
    kind,
    color,
    sortOrder: i + 1,
    isActive: true,
  }));
  const clientStages = lookup(['שיחת היכרות', 'אבחון', 'פגישות ייעוץ', 'בניית תוכנית', 'ליווי בחיפוש עבודה']);

  const base = { createdBy: manager.id, archivedAt: null, convertedClientId: null, convertedAt: null };
  const leads: DbState['leads'] = [
    { ...base, id: id(), fullName: 'דנה אברהם', phone: '0524445566', email: 'dana@example.com', sourceId: leadSources[0].id, statusId: leadStatuses[0].id, inquiry: 'סיימה תואר בפסיכולוגיה ומתלבטת לגבי הכיוון המקצועי.', createdAt: iso(-1), updatedAt: iso(-1) },
    { ...base, id: id(), fullName: 'שירה מזרחי', phone: '0547778899', email: null, sourceId: leadSources[1].id, statusId: leadStatuses[1].id, inquiry: 'אחרי 10 שנים בהוראה, רוצה הסבה מקצועית.', createdAt: iso(-3), updatedAt: iso(-2) },
    { ...base, id: id(), fullName: 'יעל גולן', phone: '0539990011', email: 'yael.g@example.com', sourceId: leadSources[3].id, statusId: leadStatuses[3].id, inquiry: 'חוזרת לשוק העבודה אחרי חופשת לידה ארוכה.', createdAt: iso(-6), updatedAt: iso(-4) },
    { ...base, id: id(), fullName: 'אורית שמעוני', phone: '0581212121', email: null, sourceId: leadSources[4].id, statusId: leadStatuses[4].id, inquiry: 'ביקשה מידע על מחירים בלבד.', createdAt: iso(-12), updatedAt: iso(-10) },
  ];

  const client = (
    fullName: string,
    phone: string,
    counselorId: string,
    stageIndex: number,
    startedDaysAgo: number,
    background: string,
  ): DbState['clients'][number] => ({
    id: id(),
    leadId: null,
    fullName,
    phone,
    email: null,
    background,
    counselorId,
    stageId: clientStages[stageIndex].id,
    status: 'active',
    startedAt: day(-startedDaysAgo),
    endedAt: null,
    endReason: null,
    endSummary: null,
    feedbackRating: null,
    feedbackText: null,
    createdBy: manager.id,
    createdAt: iso(-startedDaysAgo),
    updatedAt: iso(-startedDaysAgo),
    archivedAt: null,
  });

  const c1 = client('הילה ברק', '0505550001', michal.id, 2, 30, 'מהנדסת תעשייה וניהול, מרגישה שחיקה ורוצה תפקיד עם יותר עבודה עם אנשים.');
  const c2 = client('רונית אלון', '0505550002', michal.id, 1, 10, 'בוגרת תיכון, מתלבטת בין לימודים אקדמיים למקצוע טכני.');
  const c3 = client('טל חדד', '0505550003', noa.id, 4, 45, 'מחפשת עבודה בתחום משאבי אנוש אחרי הסבה.');
  const c4 = client('סיגל נחום', '0505550004', noa.id, 0, 2, 'הגיעה בהמלצת חברה. רוצה לבדוק התאמה לתחום החינוך המיוחד.');

  return {
    version: 1,
    users: [manager, michal, noa],
    leadSources,
    leadStatuses,
    clientStages,
    leads,
    clients: [c1, c2, c3, c4],
    activities: [
      { id: id(), leadId: leads[1].id, clientId: null, kind: 'call', content: 'לא ענתה. השארתי הודעה קולית.', occurredAt: iso(-2, 11), createdBy: manager.id, createdAt: iso(-2, 11), updatedAt: iso(-2, 11) },
      { id: id(), leadId: leads[2].id, clientId: null, kind: 'call', content: 'שיחה טובה. הסברתי על התהליך והמחיר. רוצה להתייעץ עם בן הזוג.', occurredAt: iso(-4, 15), createdBy: manager.id, createdAt: iso(-4, 15), updatedAt: iso(-4, 15) },
      { id: id(), leadId: null, clientId: c1.id, kind: 'note', content: 'נשלח שאלון תחומי עניין לקראת הפגישה הבאה.', occurredAt: iso(-5, 9), createdBy: michal.id, createdAt: iso(-5, 9), updatedAt: iso(-5, 9) },
      { id: id(), leadId: null, clientId: c3.id, kind: 'message', content: 'שלחתי שלוש משרות רלוונטיות בוואטסאפ.', occurredAt: iso(-1, 13), createdBy: noa.id, createdAt: iso(-1, 13), updatedAt: iso(-1, 13) },
    ],
    tasks: [
      { id: id(), leadId: leads[2].id, clientId: null, title: 'לחזור ליעל לגבי ההחלטה', dueDate: day(0), assigneeId: manager.id, completedAt: null, createdBy: manager.id, createdAt: iso(-4), updatedAt: iso(-4) },
      { id: id(), leadId: leads[0].id, clientId: null, title: 'שיחה ראשונה עם דנה', dueDate: day(-1), assigneeId: manager.id, completedAt: null, createdBy: manager.id, createdAt: iso(-1), updatedAt: iso(-1) },
      { id: id(), leadId: null, clientId: c1.id, title: 'להכין סיכום ממצאי השאלון', dueDate: day(1), assigneeId: michal.id, completedAt: null, createdBy: michal.id, createdAt: iso(-5), updatedAt: iso(-5) },
      { id: id(), leadId: null, clientId: c2.id, title: 'לשלוח לרונית מידע על מכינות', dueDate: day(-2), assigneeId: michal.id, completedAt: null, createdBy: michal.id, createdAt: iso(-6), updatedAt: iso(-6) },
      { id: id(), leadId: null, clientId: c3.id, title: 'לעבור על קורות החיים המעודכנים', dueDate: day(2), assigneeId: noa.id, completedAt: null, createdBy: noa.id, createdAt: iso(-2), updatedAt: iso(-2) },
    ],
    meetings: [
      { id: id(), clientId: c1.id, startsAt: iso(-7, 17), durationMinutes: 60, mode: 'in_person', status: 'done', summary: 'עברנו על ההיסטוריה התעסוקתית. עלו חוזקות בניהול פרויקטים ובהדרכה.', createdBy: michal.id, createdAt: iso(-8), updatedAt: iso(-7) },
      { id: id(), clientId: c1.id, startsAt: iso(2, 17), durationMinutes: 60, mode: 'video', status: 'scheduled', summary: null, createdBy: michal.id, createdAt: iso(-7), updatedAt: iso(-7) },
      { id: id(), clientId: c2.id, startsAt: iso(1, 10), durationMinutes: 90, mode: 'in_person', status: 'scheduled', summary: null, createdBy: michal.id, createdAt: iso(-3), updatedAt: iso(-3) },
      { id: id(), clientId: c3.id, startsAt: iso(3, 12), durationMinutes: 45, mode: 'phone', status: 'scheduled', summary: null, createdBy: noa.id, createdAt: iso(-2), updatedAt: iso(-2) },
    ],
    assessments: [
      { id: id(), clientId: c1.id, title: 'שאלון תחומי עניין', assessedOn: day(-6), findings: 'נטייה גבוהה לתחומים חברתיים ויזמיים.', createdBy: michal.id, createdAt: iso(-6), updatedAt: iso(-6) },
    ],
    files: [],
    stageHistory: [c1, c2, c3, c4].map((c) => ({
      id: id(),
      clientId: c.id,
      fromStageId: null,
      toStageId: c.stageId,
      changedBy: manager.id,
      changedAt: c.createdAt,
    })),
    notifications: [
      { id: id(), userId: noa.id, kind: 'client_assigned', title: 'שויכה אלייך לקוחה חדשה: סיגל נחום', body: null, clientId: c4.id, taskId: null, readAt: null, createdAt: iso(-2) },
    ],
    audit: [],
  };
}
