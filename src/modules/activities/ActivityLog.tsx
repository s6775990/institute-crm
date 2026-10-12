import { useQuery } from '@tanstack/react-query';
import { Mail, MessageCircle, NotebookPen, Pencil, Phone, Trash2, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatDateTime, toDateTimeLocal } from '../../core/format';
import { ACTIVITY_LABELS } from '../../core/labels';
import { can } from '../../core/permissions';
import type { Activity, ActivityKind } from '../../core/types';
import { useData } from '../../data/DataContext';
import type { EntryParent } from '../../data/DataService';
import { useStaffNames } from '../../data/queries';
import { Button } from '../../ui/Button';
import { ErrorState, Loading } from '../../ui/common';
import { Dialog } from '../../ui/Dialog';
import { useConfirm } from '../../ui/feedback';
import { Field, FormError, Input, Select, Textarea } from '../../ui/Field';
import { useAction, useSubmit } from '../../ui/useSubmit';

const ICONS: Record<ActivityKind, typeof Phone> = {
  call: Phone,
  message: MessageCircle,
  email: Mail,
  meeting: Users,
  note: NotebookPen,
};

const KINDS = Object.keys(ACTIVITY_LABELS) as ActivityKind[];

function ActivityForm({
  initial,
  onSave,
  onCancel,
  submitLabel,
}: {
  initial?: Activity;
  onSave: (input: { kind: ActivityKind; content: string; occurredAt: string }) => Promise<void>;
  onCancel?: () => void;
  submitLabel: string;
}) {
  const [kind, setKind] = useState<ActivityKind>(initial?.kind ?? 'call');
  const [content, setContent] = useState(initial?.content ?? '');
  const [occurredAt, setOccurredAt] = useState(toDateTimeLocal(initial?.occurredAt ?? new Date()));
  const { submit, pending, errors, formError } = useSubmit();

  const save = async () => {
    const result = await submit(() => onSave({ kind, content, occurredAt }), 'התיעוד נשמר');
    if (result.ok && !initial) {
      setContent('');
      setOccurredAt(toDateTimeLocal(new Date()));
    }
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      className="space-y-3"
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="סוג" error={errors.kind}>
          <Select value={kind} onChange={(e) => setKind(e.target.value as ActivityKind)}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {ACTIVITY_LABELS[k]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="מתי?" error={errors.occurredAt}>
          <Input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} />
        </Field>
      </div>
      <Field label="מה היה?" error={errors.content} required>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder="לדוגמה: דיברנו על..., סיכמנו ש..." />
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button variant="secondary" onClick={onCancel}>
            ביטול
          </Button>
        )}
        <Button type="submit" loading={pending}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

/** Call/message/note history for a lead or a client, with a quick "add" form. */
export function ActivityLog({ parent, readOnly = false }: { parent: EntryParent; readOnly?: boolean }) {
  const data = useData();
  const me = useCurrentUser();
  const names = useStaffNames();
  const confirm = useConfirm();
  const { run } = useAction();
  const [editing, setEditing] = useState<Activity | null>(null);
  const [formKey, setFormKey] = useState(0);
  const query = useQuery({ queryKey: ['activities', parent], queryFn: () => data.listActivities(parent) });

  useEffect(() => setFormKey((k) => k + 1), [parent]);

  const add = (input: { kind: ActivityKind; content: string; occurredAt: string }) => data.addActivity(parent, input);

  const remove = async (a: Activity) => {
    const ok = await confirm({ title: 'מחיקת רישום', message: 'למחוק את הרישום הזה? אי אפשר לבטל את המחיקה.', confirmLabel: 'כן, למחוק', danger: true });
    if (ok) await run(() => data.deleteActivity(a.id), 'הרישום נמחק');
  };

  return (
    <div className="space-y-5">
      {!readOnly && (
        <div className="rounded-xl border border-brand-100 bg-brand-50/50 p-4">
          <h3 className="mb-3 font-bold text-slate-900">תיעוד חדש</h3>
          <ActivityForm key={formKey} onSave={add} submitLabel="שמירת התיעוד" />
        </div>
      )}

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <p className="py-2 text-slate-500">עדיין לא תועדו שיחות או הערות.</p>
      ) : (
        <ol className="space-y-3">
          {query.data!.map((a) => {
            const Icon = ICONS[a.kind];
            return (
              <li key={a.id} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
                    <span className="font-semibold text-slate-800">{ACTIVITY_LABELS[a.kind]}</span>
                    <span>{formatDateTime(a.occurredAt)}</span>
                    <span>נכתב ע"י {names(a.createdBy)}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap leading-relaxed text-slate-800">{a.content}</p>
                </div>
                {!readOnly && can.modifyEntry(me, a) && (
                  <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                    <button type="button" onClick={() => setEditing(a)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="עריכת הרישום" title="עריכה">
                      <Pencil className="h-5 w-5" aria-hidden />
                    </button>
                    <button type="button" onClick={() => remove(a)} className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700" aria-label="מחיקת הרישום" title="מחיקה">
                      <Trash2 className="h-5 w-5" aria-hidden />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <Dialog open={editing !== null} onClose={() => setEditing(null)} title="עריכת רישום">
        {editing && (
          <ActivityForm
            initial={editing}
            submitLabel="שמירת השינויים"
            onCancel={() => setEditing(null)}
            onSave={async (input) => {
              await data.updateActivity(editing.id, input);
              setEditing(null);
            }}
          />
        )}
      </Dialog>
    </div>
  );
}
