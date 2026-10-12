import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatDateTime, toDateTimeLocal } from '../../core/format';
import { MEETING_MODE_LABELS, MEETING_STATUS_LABELS } from '../../core/labels';
import { can } from '../../core/permissions';
import type { BadgeColor, Client, Meeting, MeetingMode, MeetingStatus } from '../../core/types';
import { useData } from '../../data/DataContext';
import { useStaffNames } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Badge, ErrorState, Loading } from '../../ui/common';
import { Dialog } from '../../ui/Dialog';
import { useConfirm } from '../../ui/feedback';
import { Field, FormError, Input, Select, Textarea } from '../../ui/Field';
import { useAction, useSubmit } from '../../ui/useSubmit';

const STATUS_COLORS: Record<MeetingStatus, BadgeColor> = { scheduled: 'blue', done: 'green', canceled: 'gray' };
const DURATIONS = [30, 45, 60, 90, 120];

function nextRoundHour() {
  const d = new Date();
  d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function MeetingDialog({ open, onClose, clientId, meeting }: { open: boolean; onClose: () => void; clientId: string; meeting: Meeting | null }) {
  const data = useData();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [form, setForm] = useState({ startsAt: '', durationMinutes: 60, mode: 'in_person' as MeetingMode, status: 'scheduled' as MeetingStatus, summary: '' });

  useEffect(() => {
    if (!open) return;
    reset();
    setForm(
      meeting
        ? { startsAt: toDateTimeLocal(meeting.startsAt), durationMinutes: meeting.durationMinutes, mode: meeting.mode, status: meeting.status, summary: meeting.summary ?? '' }
        : { startsAt: toDateTimeLocal(nextRoundHour()), durationMinutes: 60, mode: 'phone', status: 'scheduled', summary: '' },
    );
  }, [open, meeting, reset]);

  const save = async () => {
    const result = await submit(
      () => (meeting ? data.updateMeeting(meeting.id, form) : data.addMeeting(clientId, form)),
      meeting ? 'השיחה עודכנה' : 'השיחה תואמה',
    );
    if (result.ok) onClose();
  };

  const durations = DURATIONS.includes(form.durationMinutes) ? DURATIONS : [...DURATIONS, form.durationMinutes].sort((a, b) => a - b);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      size="lg"
      title={meeting ? 'שיחה וסיכום' : 'תיאום שיחה'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            שמירה
          </Button>
        </>
      }
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="מתי?" error={errors.startsAt} required>
          <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm((f) => ({ ...f, startsAt: e.target.value }))} />
        </Field>
        <Field label="כמה זמן?" error={errors.durationMinutes}>
          <Select value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) }))}>
            {durations.map((d) => (
              <option key={d} value={d}>
                {d} דקות
              </option>
            ))}
          </Select>
        </Field>
        <Field label="איך?" error={errors.mode}>
          <Select value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value as MeetingMode }))}>
            {(Object.keys(MEETING_MODE_LABELS) as MeetingMode[]).map((m) => (
              <option key={m} value={m}>
                {MEETING_MODE_LABELS[m]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מצב השיחה" error={errors.status}>
          <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as MeetingStatus }))}>
            {(Object.keys(MEETING_STATUS_LABELS) as MeetingStatus[]).map((s) => (
              <option key={s} value={s}>
                {MEETING_STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="סיכום השיחה" error={errors.summary} hint="מה עלה בשיחה, מה סוכם ומה הצעדים הבאים">
        <Textarea
          value={form.summary}
          onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value, status: e.target.value && f.status === 'scheduled' ? 'done' : f.status }))}
          rows={8}
        />
      </Field>
    </Dialog>
  );
}

export function MeetingsTab({ client, editable }: { client: Client; editable: boolean }) {
  const data = useData();
  const me = useCurrentUser();
  const names = useStaffNames();
  const confirm = useConfirm();
  const { run } = useAction();
  const [dialog, setDialog] = useState<{ meeting: Meeting | null } | null>(null);
  const query = useQuery({ queryKey: ['meetings', client.id], queryFn: () => data.listMeetings(client.id) });

  const remove = async (m: Meeting) => {
    const ok = await confirm({ title: 'מחיקת שיחה', message: `למחוק את השיחה מ-${formatDateTime(m.startsAt)} כולל הסיכום שלה?`, confirmLabel: 'כן, למחוק', danger: true });
    if (ok) await run(() => data.deleteMeeting(m.id), 'השיחה נמחקה');
  };

  return (
    <div className="space-y-4">
      {editable && (
        <Button icon={<CalendarPlus className="h-5 w-5" aria-hidden />} onClick={() => setDialog({ meeting: null })}>
          תיאום שיחה
        </Button>
      )}
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data!.length === 0 ? (
        <p className="text-slate-500">עדיין לא תואמו שיחות.</p>
      ) : (
        <ul className="space-y-3">
          {query.data!.map((m) => (
            <li key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-lg font-semibold">{formatDateTime(m.startsAt)}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <Badge color={STATUS_COLORS[m.status]}>{MEETING_STATUS_LABELS[m.status]}</Badge>
                    <span>{MEETING_MODE_LABELS[m.mode]}</span>
                    <span>{m.durationMinutes} דקות</span>
                  </div>
                </div>
                {editable && (
                  <div className="flex gap-1">
                    <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setDialog({ meeting: m })}>
                      {m.summary ? 'עריכה' : 'כתיבת סיכום'}
                    </Button>
                    {can.modifyEntry(me, m) && (
                      <button type="button" onClick={() => remove(m)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label="מחיקת השיחה" title="מחיקה">
                        <Trash2 className="h-5 w-5" aria-hidden />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {m.summary && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <p className="whitespace-pre-wrap leading-relaxed text-slate-800">{m.summary}</p>
                  <p className="mt-2 text-sm text-slate-500">נקבעה ע"י {names(m.createdBy)}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <MeetingDialog open={dialog !== null} onClose={() => setDialog(null)} clientId={client.id} meeting={dialog?.meeting ?? null} />
    </div>
  );
}
