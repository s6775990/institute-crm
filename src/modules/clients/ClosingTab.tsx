import { Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatDate, todayDateOnly } from '../../core/format';
import { CLIENT_STATUS_LABELS } from '../../core/labels';
import type { Client, ClientStatus } from '../../core/types';
import { useData } from '../../data/DataContext';
import { Button } from '../../ui/Button';
import { Detail, Section } from '../../ui/common';
import { useConfirm } from '../../ui/feedback';
import { Field, FormError, Input, Textarea } from '../../ui/Field';
import { useAction, useSubmit } from '../../ui/useSubmit';

function CloseForm({ client }: { client: Client }) {
  const data = useData();
  const confirm = useConfirm();
  const { submit, pending, errors, formError } = useSubmit();
  const [status, setStatus] = useState<Exclude<ClientStatus, 'active'>>('completed');
  const [endedAt, setEndedAt] = useState(todayDateOnly());
  const [endReason, setEndReason] = useState(client.endReason ?? '');
  const [endSummary, setEndSummary] = useState(client.endSummary ?? '');

  const save = async () => {
    const ok = await confirm({
      title: 'סיום התהליך',
      message: `לסמן שהתהליך של ${client.fullName} ${status === 'completed' ? 'הסתיים' : 'הופסק'}? אפשר לפתוח אותו מחדש בכל עת.`,
      confirmLabel: 'כן, לסיים',
    });
    if (!ok) return;
    await submit(() => data.closeClient(client.id, { status, endedAt, endReason, endSummary }), 'התהליך סומן כמסתיים');
  };

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <fieldset>
        <legend className="mb-2 font-medium">איך הסתיים התהליך?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(['completed', 'stopped'] as const).map((s) => (
            <label
              key={s}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-4 font-medium transition ${
                status === s ? 'border-brand-600 bg-brand-50' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <input type="radio" name="close-status" value={s} checked={status === s} onChange={() => setStatus(s)} className="h-5 w-5 accent-brand-700" />
              {s === 'completed' ? 'סיימה את התהליך כמתוכנן' : 'הפסיקה באמצע'}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="תאריך סיום" error={errors.endedAt} required>
          <Input type="date" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
        </Field>
        {status === 'stopped' && (
          <Field label="למה הפסיקה?" error={errors.endReason}>
            <Input value={endReason} onChange={(e) => setEndReason(e.target.value)} maxLength={500} />
          </Field>
        )}
      </div>
      <Field label="סיכום התהליך" error={errors.endSummary} hint="לאן הגיעה, מה הושג, המלצות להמשך">
        <Textarea value={endSummary} onChange={(e) => setEndSummary(e.target.value)} rows={6} />
      </Field>
      <div className="flex justify-end">
        <Button type="submit" loading={pending}>
          סיום התהליך
        </Button>
      </div>
    </form>
  );
}

function FeedbackForm({ client, editable }: { client: Client; editable: boolean }) {
  const data = useData();
  const { submit, pending, errors, formError } = useSubmit();
  const [rating, setRating] = useState<number | null>(client.feedbackRating);
  const [text, setText] = useState(client.feedbackText ?? '');

  useEffect(() => {
    setRating(client.feedbackRating);
    setText(client.feedbackText ?? '');
  }, [client.feedbackRating, client.feedbackText]);

  const dirty = rating !== client.feedbackRating || text !== (client.feedbackText ?? '');

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit(() => data.saveFeedback(client.id, { rating, text }), 'המשוב נשמר');
      }}
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <fieldset disabled={!editable}>
        <legend className="mb-2 font-medium">עד כמה הלקוחה הייתה מרוצה? (1 עד 5)</legend>
        <div className="flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              aria-pressed={rating !== null && n <= rating}
              aria-label={`${n} מתוך 5`}
              className="rounded-lg p-1.5 hover:bg-amber-50 disabled:cursor-default"
            >
              <Star className={`h-9 w-9 ${rating !== null && n <= rating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} aria-hidden />
            </button>
          ))}
          {rating !== null && <span className="ms-2 font-medium text-slate-700">{rating} מתוך 5</span>}
        </div>
        {errors.rating && <p className="mt-1 text-sm text-red-700">{errors.rating}</p>}
      </fieldset>
      <Field label="מה הלקוחה אמרה?" error={errors.text}>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} disabled={!editable} />
      </Field>
      {editable && (
        <div className="flex justify-end">
          <Button type="submit" loading={pending} disabled={!dirty}>
            שמירת המשוב
          </Button>
        </div>
      )}
    </form>
  );
}

export function ClosingTab({ client, editable }: { client: Client; editable: boolean }) {
  const data = useData();
  const confirm = useConfirm();
  const { run, pending } = useAction();

  const reopen = async () => {
    const ok = await confirm({ title: 'פתיחה מחדש', message: `להחזיר את ${client.fullName} לתהליך פעיל? הסיכום הקודם יישמר.`, confirmLabel: 'כן, לפתוח מחדש' });
    if (ok) await run(() => data.reopenClient(client.id), 'התהליך נפתח מחדש');
  };

  return (
    <div className="space-y-5">
      <Section title="סיום התהליך">
        {client.status === 'active' ? (
          editable ? <CloseForm client={client} /> : <p className="text-slate-500">התהליך עדיין פעיל.</p>
        ) : (
          <div className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Detail label="מצב">{CLIENT_STATUS_LABELS[client.status]}</Detail>
              <Detail label="תאריך סיום">{formatDate(client.endedAt)}</Detail>
              {client.endReason && <Detail label="סיבה">{client.endReason}</Detail>}
            </dl>
            <Detail label="סיכום">{client.endSummary && <span className="whitespace-pre-wrap">{client.endSummary}</span>}</Detail>
            {editable && (
              <Button variant="secondary" loading={pending} onClick={reopen}>
                פתיחת התהליך מחדש
              </Button>
            )}
          </div>
        )}
      </Section>
      <Section title="משוב מהלקוחה">
        <FeedbackForm client={client} editable={editable} />
      </Section>
    </div>
  );
}
