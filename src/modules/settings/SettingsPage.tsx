import { useQuery } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { formatDateTime } from '../../core/format';
import { BADGE_COLOR_LABELS } from '../../core/labels';
import type { BadgeColor, LeadStatus, LookupItem, LookupKind } from '../../core/types';
import { useAuth } from '../../auth/AuthContext';
import { useData, useDemo } from '../../data/DataContext';
import { useLookups, useStaffNames } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Badge, ErrorState, Loading, PageHeader, Section } from '../../ui/common';
import { Dialog } from '../../ui/Dialog';
import { useConfirm } from '../../ui/feedback';
import { Field, FormError, Input, Select } from '../../ui/Field';
import { useAction, useSubmit } from '../../ui/useSubmit';

const LISTS: { kind: LookupKind; title: string; description: string; itemLabel: string }[] = [
  { kind: 'leadSources', title: 'מקורות הגעה', description: 'איך מתעניינות שומעות על המכון', itemLabel: 'מקור' },
  { kind: 'leadStatuses', title: 'סטטוסים של לידים', description: 'השלבים בטיפול בפנייה עד שהיא הופכת ללקוחה', itemLabel: 'סטטוס' },
  { kind: 'clientStages', title: 'שלבי התהליך של לקוחה', description: 'השלבים שכל לקוחה עוברת, לפי הסדר', itemLabel: 'שלב' },
];

const COLORS = Object.keys(BADGE_COLOR_LABELS) as BadgeColor[];

function ItemDialog({ kind, itemLabel, item, open, onClose }: { kind: LookupKind; itemLabel: string; item: LookupItem | null; open: boolean; onClose: () => void }) {
  const data = useData();
  const { submit, pending, errors, formError } = useSubmit();
  const status = item as LeadStatus | null;
  const [name, setName] = useState(item?.name ?? '');
  const [statusKind, setStatusKind] = useState<LeadStatus['kind']>(status?.kind ?? 'open');
  const [color, setColor] = useState<BadgeColor>(status?.color ?? 'blue');
  const isStatus = kind === 'leadStatuses';

  const save = async () => {
    const input = { name, ...(isStatus ? { kind: statusKind, color } : {}) };
    const r = await submit(() => (item ? data.updateLookupItem(kind, item.id, input) : data.addLookupItem(kind, input)), 'נשמר');
    if (r.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      title={item ? `עריכת ${itemLabel}` : `הוספת ${itemLabel}`}
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
      <Field label="שם" error={errors.name} required hint={item ? 'שינוי השם יתעדכן בכל המקומות שבהם הוא מופיע' : undefined}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
      </Field>
      {isStatus && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="משמעות" error={errors.kind}>
            <Select value={statusKind} onChange={(e) => setStatusKind(e.target.value as LeadStatus['kind'])}>
              <option value="open">הליד עדיין בטיפול</option>
              <option value="lost">הליד נסגר – לא רלוונטי</option>
            </Select>
          </Field>
          <Field label="צבע" error={errors.color}>
            <Select value={color} onChange={(e) => setColor(e.target.value as BadgeColor)}>
              {COLORS.map((c) => (
                <option key={c} value={c}>
                  {BADGE_COLOR_LABELS[c]}
                </option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <span className="text-sm text-slate-500">כך זה ייראה: </span>
            <Badge color={color}>{name || 'דוגמה'}</Badge>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function LookupList({ kind, title, description, itemLabel, items }: (typeof LISTS)[number] & { items: LookupItem[] }) {
  const data = useData();
  const { run } = useAction();
  const [dialog, setDialog] = useState<{ item: LookupItem | null; key: number } | null>(null);

  return (
    <Section
      title={title}
      actions={
        <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setDialog({ item: null, key: Date.now() })}>
          הוספת {itemLabel}
        </Button>
      }
    >
      <p className="-mt-2 mb-3 text-slate-600">{description}</p>
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {items.map((item, i) => (
          <li key={item.id} className={`flex items-center gap-2 px-3 py-2 ${item.isActive ? '' : 'bg-slate-50'}`}>
            <span className={`flex-1 ${item.isActive ? 'font-medium' : 'text-slate-400 line-through'}`}>
              {kind === 'leadStatuses' ? <Badge color={(item as LeadStatus).color}>{item.name}</Badge> : item.name}
              {kind === 'leadStatuses' && (item as LeadStatus).kind === 'lost' && <span className="ms-2 text-sm text-slate-500">(סוגר את הליד)</span>}
              {!item.isActive && <span className="ms-2 text-sm text-slate-500 no-underline">מוסתר</span>}
            </span>
            <button type="button" disabled={i === 0} onClick={() => run(() => data.moveLookupItem(kind, item.id, 'up'))} className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`להזיז את ${item.name} למעלה`} title="למעלה">
              <ArrowUp className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" disabled={i === items.length - 1} onClick={() => run(() => data.moveLookupItem(kind, item.id, 'down'))} className="rounded p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30" aria-label={`להזיז את ${item.name} למטה`} title="למטה">
              <ArrowDown className="h-4 w-4" aria-hidden />
            </button>
            <button type="button" onClick={() => setDialog({ item, key: Date.now() })} className="rounded p-2 text-slate-500 hover:bg-slate-100" aria-label={`עריכת ${item.name}`} title="עריכה">
              <Pencil className="h-4 w-4" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => run(() => data.setLookupItemActive(kind, item.id, !item.isActive), item.isActive ? `"${item.name}" הוסתר` : `"${item.name}" חזר לשימוש`)}
              className="rounded p-2 text-slate-500 hover:bg-slate-100"
              aria-label={item.isActive ? `הסתרת ${item.name}` : `החזרת ${item.name} לשימוש`}
              title={item.isActive ? 'הסתרה' : 'החזרה לשימוש'}
            >
              {item.isActive ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm text-slate-500">פריט מוסתר לא יופיע בבחירות חדשות, אבל יישאר בכרטיסים שכבר משתמשים בו.</p>
      {dialog && <ItemDialog key={dialog.key} kind={kind} itemLabel={itemLabel} item={dialog.item} open onClose={() => setDialog(null)} />}
    </Section>
  );
}

function AuditLog() {
  const data = useData();
  const names = useStaffNames();
  const query = useQuery({ queryKey: ['audit'], queryFn: () => data.listAudit(100) });
  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} />;
  if (query.data!.length === 0) return <p className="text-slate-500">עדיין אין פעולות ביומן.</p>;
  return (
    <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto text-sm">
      {query.data!.map((a) => (
        <li key={a.id} className="flex flex-wrap gap-x-3 py-2">
          <span className="text-slate-500">{formatDateTime(a.createdAt)}</span>
          <span className="font-medium">{names(a.actorId) || 'המערכת'}</span>
          <span className="text-slate-700">{a.summary}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SettingsPage() {
  const demo = useDemo();
  const { signOut } = useAuth();
  const confirm = useConfirm();
  const { run } = useAction();
  const lookups = useLookups();

  const resetDemo = async () => {
    const ok = await confirm({
      title: 'איפוס נתוני ההדגמה',
      message: 'כל מה שהוזן במערכת בדפדפן הזה יימחק ויוחלף בנתוני הדוגמה המקוריים. תצטרכי להיכנס מחדש.',
      confirmLabel: 'כן, לאפס',
      danger: true,
    });
    if (ok && demo && (await run(() => demo.resetDemoData()))) await signOut();
  };

  return (
    <>
      <PageHeader title="הגדרות" subtitle="רשימות הבחירה במערכת. אפשר לשנות אותן בכל עת." />
      {lookups.isLoading ? (
        <Loading />
      ) : lookups.error ? (
        <ErrorState error={lookups.error} onRetry={() => lookups.refetch()} />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {LISTS.map((l) => (
            <LookupList key={l.kind} {...l} items={lookups.data![l.kind]} />
          ))}
          <Section title="יומן פעולות">
            <p className="-mt-2 mb-3 text-slate-600">פעולות רגישות שבוצעו במערכת: מי עשתה מה ומתי.</p>
            <AuditLog />
          </Section>
        </div>
      )}
      {demo && (
        <Section title="מצב הדגמה" className="mt-5 border-amber-200">
          <p className="mb-3 text-slate-700">כרגע המערכת שומרת את המידע רק בדפדפן הזה. אפשר להחזיר את נתוני הדוגמה למצב ההתחלתי.</p>
          <Button variant="secondary" icon={<RotateCcw className="h-5 w-5" aria-hidden />} onClick={resetDemo}>
            איפוס נתוני ההדגמה
          </Button>
        </Section>
      )}
    </>
  );
}
