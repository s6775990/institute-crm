// Domain model shared by the UI and every data-service implementation.
// Field names mirror the future database columns (camelCase here, snake_case in SQL).

export type Role = 'admin' | 'counselor';

/** ISO timestamp, e.g. 2026-10-12T09:30:00.000Z */
export type Timestamp = string;
/** Calendar date, YYYY-MM-DD */
export type DateOnly = string;

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: Timestamp;
}

export type BadgeColor = 'gray' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

export interface LookupItem {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

export interface LeadStatus extends LookupItem {
  /** "open" statuses keep the lead in the active pipeline; "lost" closes it. */
  kind: 'open' | 'lost';
  color: BadgeColor;
}

export interface Lookups {
  leadSources: LookupItem[];
  leadStatuses: LeadStatus[];
  clientStages: LookupItem[];
}

export type LookupKind = keyof Lookups;

export interface Lead {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  sourceId: string | null;
  statusId: string;
  inquiry: string | null;
  convertedClientId: string | null;
  convertedAt: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt: Timestamp | null;
}

export type ClientStatus = 'active' | 'completed' | 'stopped';

export interface Client {
  id: string;
  leadId: string | null;
  fullName: string;
  phone: string | null;
  email: string | null;
  background: string | null;
  counselorId: string;
  stageId: string | null;
  status: ClientStatus;
  startedAt: DateOnly;
  endedAt: DateOnly | null;
  endReason: string | null;
  endSummary: string | null;
  feedbackRating: number | null;
  feedbackText: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  archivedAt: Timestamp | null;
}

export type ActivityKind = 'call' | 'message' | 'email' | 'meeting' | 'note';

export interface Activity {
  id: string;
  leadId: string | null;
  clientId: string | null;
  kind: ActivityKind;
  content: string;
  occurredAt: Timestamp;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Task {
  id: string;
  leadId: string | null;
  clientId: string | null;
  title: string;
  dueDate: DateOnly | null;
  assigneeId: string;
  completedAt: Timestamp | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type MeetingMode = 'in_person' | 'video' | 'phone';
export type MeetingStatus = 'scheduled' | 'done' | 'canceled';

export interface Meeting {
  id: string;
  clientId: string;
  startsAt: Timestamp;
  durationMinutes: number;
  mode: MeetingMode;
  status: MeetingStatus;
  summary: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Assessment {
  id: string;
  clientId: string;
  title: string;
  assessedOn: DateOnly | null;
  findings: string | null;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface AttachedFile {
  id: string;
  assessmentId: string;
  clientId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: Timestamp;
}

export interface StageChange {
  id: string;
  clientId: string;
  fromStageId: string | null;
  toStageId: string | null;
  changedBy: string;
  changedAt: Timestamp;
}

export type NotificationKind = 'client_assigned' | 'task_assigned';

export interface AppNotification {
  id: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  clientId: string | null;
  taskId: string | null;
  readAt: Timestamp | null;
  createdAt: Timestamp;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string;
  createdAt: Timestamp;
}
