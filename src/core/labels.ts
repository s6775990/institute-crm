// Hebrew labels for fixed values.

import type { ActivityKind, BadgeColor, ClientStatus, MeetingMode, MeetingStatus, Role } from './types.ts';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'מנהלת',
  counselor: 'יועצת',
};

export const ACTIVITY_LABELS: Record<ActivityKind, string> = {
  call: 'שיחת טלפון',
  message: 'הודעה (וואטסאפ / SMS)',
  email: 'מייל',
  meeting: 'פגישה',
  note: 'הערה',
};

export const MEETING_MODE_LABELS: Record<MeetingMode, string> = {
  in_person: 'פגישה במכון',
  video: 'פגישה בזום / וידאו',
  phone: 'שיחת טלפון',
};

export const MEETING_STATUS_LABELS: Record<MeetingStatus, string> = {
  scheduled: 'מתוכננת',
  done: 'התקיימה',
  canceled: 'בוטלה',
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  active: 'בתהליך',
  completed: 'סיימה את התהליך',
  stopped: 'הפסיקה את התהליך',
};

export const BADGE_COLOR_LABELS: Record<BadgeColor, string> = {
  gray: 'אפור',
  blue: 'כחול',
  green: 'ירוק',
  amber: 'כתום',
  red: 'אדום',
  purple: 'סגול',
};
