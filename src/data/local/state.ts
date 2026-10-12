import type {
  Activity,
  AppNotification,
  Assessment,
  AttachedFile,
  AuditEntry,
  Client,
  Lead,
  LeadStatus,
  LookupItem,
  Meeting,
  Profile,
  StageChange,
  Task,
} from '../../core/types.ts';

export interface StoredUser extends Profile {
  passwordHash: string;
  passwordSalt: string;
  failedLogins: number;
  lockedUntil: string | null;
}

export interface DbState {
  version: 1;
  users: StoredUser[];
  leadSources: LookupItem[];
  leadStatuses: LeadStatus[];
  clientStages: LookupItem[];
  leads: Lead[];
  clients: Client[];
  activities: Activity[];
  tasks: Task[];
  meetings: Meeting[];
  assessments: Assessment[];
  files: AttachedFile[];
  stageHistory: StageChange[];
  notifications: AppNotification[];
  audit: AuditEntry[];
}

export interface StoredSession {
  userId: string;
  expiresAt: string;
}
