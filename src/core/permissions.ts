// Single source of truth for "who may do what".
// The data layer enforces these rules on every call; the UI uses them only to
// decide what to show. When a real database is connected, the same rules are
// expressed as row-level security policies (see docs/data-connection.md).

import type { Client, Profile, Task } from './types.ts';

export function isAdmin(user: Profile): boolean {
  return user.isActive && user.role === 'admin';
}

export const can = {
  manageLeads: isAdmin,
  manageTeam: isAdmin,
  manageSettings: isAdmin,
  createClient: isAdmin,
  assignClient: isAdmin,
  archiveClient: isAdmin,
  viewAuditLog: isAdmin,

  viewClient(user: Profile, client: Client): boolean {
    if (!user.isActive) return false;
    if (user.role === 'admin') return true;
    return client.counselorId === user.id && client.archivedAt === null;
  },

  /** Notes, meetings, assessments, files and tasks inside a client card. */
  editClientContent(user: Profile, client: Client): boolean {
    return can.viewClient(user, client) && (isAdmin(user) || client.archivedAt === null);
  },

  /** Editing or deleting an entry someone wrote: the author, or an admin. */
  modifyEntry(user: Profile, entry: { createdBy: string }): boolean {
    return isAdmin(user) || (user.isActive && entry.createdBy === user.id);
  },

  viewTask(user: Profile, task: Task, linkedClient: Client | null): boolean {
    if (!user.isActive) return false;
    if (user.role === 'admin') return true;
    if (task.leadId) return false;
    if (task.assigneeId === user.id) return true;
    return linkedClient !== null && can.viewClient(user, linkedClient);
  },
};
