import { useQuery } from '@tanstack/react-query';
import { Copy, KeyRound, Pencil, Power, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatPhone } from '../../core/format';
import { ROLE_LABELS } from '../../core/labels';
import type { Profile, Role } from '../../core/types';
import { useData } from '../../data/DataContext';
import { useStaff } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Badge, ErrorState, Loading, PageHeader } from '../../ui/common';
import { Dialog } from '../../ui/Dialog';
import { useConfirm, useToast } from '../../ui/feedback';
import { Field, FormError, Input, Select } from '../../ui/Field';
import { useAction, useSubmit } from '../../ui/useSubmit';

function StaffDialog({ open, onClose, member, onCreated }: { open: boolean; onClose: () => void; member: Profile | null; onCreated: (r: { name: string; email: string; password: string }) => void }) {
  const data = useData();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', role: 'counselor' as Role });

  useEffect(() => {
    if (!open) return;
    reset();
    setForm(member ? { fullName: member.fullName, email: member.email, phone: member.phone ?? '', role: member.role } : { fullName: '', email: '', phone: '', role: 'counselor' });
  }, [open, member, reset]);

  const save = async () => {
    if (member) {
      const r = await submit(() => data.updateStaff(member.id, form), 'הפרטים עודכנו');
      if (r.ok) onClose();
      return;
    }
    const r = await submit(() => data.createStaff(form));
    if (r.ok) {
      onClose();
      onCreated({ name: r.value.profile.fullName, email: r.value.profile.email, password: r.value.tempPassword });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      title={member ? `עריכת ${member.fullName}` : 'הוספת אשת צוות'}
      description={member ? undefined : 'המערכת תיצור סיסמה זמנית. בכניסה הראשונה היא תתבקש לבחור סיסמה משלה.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            {member ? 'שמירה' : 'יצירת משתמש'}
          </Button>
        </>
      }
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <Field label="שם מלא" error={errors.fullName} required>
        <Input value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} autoFocus />
      </Field>
      <Field label="מייל (משמש לכניסה למערכת)" error={errors.email} required>
        <Input type="email" dir="ltr" className="text-right" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="טלפון" error={errors.phone}>
          <Input type="tel" dir="ltr" className="text-right" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </Field>
        <Field label="תפקיד" error={errors.role} hint={form.role === 'admin' ? 'מנהלת רואה את כל המידע במכון' : 'יועצת רואה רק את הלקוחות שלה'}>
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
            <option value="counselor">{ROLE_LABELS.counselor}</option>
            <option value="admin">{ROLE_LABELS.admin}</option>
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

function PasswordResult({ result, onClose }: { result: { title: string; name: string; email: string; password: string } | null; onClose: () => void }) {
  const toast = useToast();
  const copy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`כניסה למערכת ניהול המכון\nמייל: ${result.email}\nסיסמה זמנית: ${result.password}`);
      toast.success('הפרטים הועתקו');
    } catch {
      toast.error('לא הצלחנו להעתיק. אפשר לרשום את הפרטים ידנית.');
    }
  };
  return (
    <Dialog open={result !== null} onClose={onClose} title={result?.title ?? ''} footer={<Button onClick={onClose}>הבנתי, סגירה</Button>}>
      {result && (
        <div className="space-y-4">
          <p className="text-lg">
            יש למסור ל<strong>{result.name}</strong> את פרטי הכניסה האלה:
          </p>
          <div className="space-y-2 rounded-xl bg-slate-100 p-4">
            <p>
              מייל: <strong dir="ltr">{result.email}</strong>
            </p>
            <p>
              סיסמה זמנית: <strong className="text-2xl tracking-widest" dir="ltr">{result.password}</strong>
            </p>
          </div>
          <Button variant="secondary" icon={<Copy className="h-5 w-5" aria-hidden />} onClick={copy}>
            העתקת הפרטים
          </Button>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">
            הסיסמה מוצגת עכשיו בלבד ולא תוצג שוב. בכניסה הראשונה היא תתבקש לבחור סיסמה חדשה.
          </p>
        </div>
      )}
    </Dialog>
  );
}

export default function TeamPage() {
  const data = useData();
  const me = useCurrentUser();
  const confirm = useConfirm();
  const { run } = useAction();
  const staff = useStaff();
  const clients = useQuery({ queryKey: ['clients', 'team-counts'], queryFn: () => data.listClients({ status: 'active' }) });
  const [dialog, setDialog] = useState<{ member: Profile | null } | null>(null);
  const [passwordResult, setPasswordResult] = useState<{ title: string; name: string; email: string; password: string } | null>(null);

  const activeCount = (id: string) => (clients.data ?? []).filter((c) => c.counselorId === id).length;

  const resetPassword = async (m: Profile) => {
    const ok = await confirm({ title: 'איפוס סיסמה', message: `ליצור ל${m.fullName} סיסמה זמנית חדשה? הסיסמה הנוכחית שלה תפסיק לעבוד.`, confirmLabel: 'כן, לאפס' });
    if (!ok) return;
    let password = '';
    if (await run(async () => (password = await data.resetStaffPassword(m.id)))) {
      setPasswordResult({ title: 'הסיסמה אופסה', name: m.fullName, email: m.email, password });
    }
  };

  const toggleActive = async (m: Profile) => {
    if (m.isActive) {
      const count = activeCount(m.id);
      const ok = await confirm({
        title: 'השבתת משתמש',
        message: (
          <>
            להשבית את {m.fullName}? היא לא תוכל להיכנס למערכת.
            {count > 0 && (
              <strong className="mt-2 block text-red-700">
                שימי לב: יש לה {count} לקוחות פעילות. מומלץ להעביר אותן ליועצת אחרת (בכרטיס כל לקוחה: "החלפת יועצת").
              </strong>
            )}
          </>
        ),
        confirmLabel: 'כן, להשבית',
        danger: true,
      });
      if (ok) await run(() => data.setStaffActive(m.id, false), `${m.fullName} הושבתה`);
    } else {
      await run(() => data.setStaffActive(m.id, true), `${m.fullName} הופעלה מחדש`);
    }
  };

  return (
    <>
      <PageHeader
        title="צוות והרשאות"
        subtitle="מי נכנסת למערכת ומה כל אחת רואה"
        actions={
          <Button icon={<UserPlus className="h-5 w-5" aria-hidden />} onClick={() => setDialog({ member: null })}>
            הוספת אשת צוות
          </Button>
        }
      />

      <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4 text-slate-700">
        <p>
          <strong>מנהלת</strong> – רואה ומנהלת הכל: לידים, כל הלקוחות, הצוות וההגדרות.
        </p>
        <p className="mt-1">
          <strong>יועצת</strong> – רואה ומנהלת רק את הלקוחות שמשויכות אליה. היא לא רואה לידים ולקוחות של יועצות אחרות.
        </p>
      </div>

      {staff.isLoading ? (
        <Loading />
      ) : staff.error ? (
        <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {staff.data!.map((m) => (
            <li key={m.id} className={`card p-4 ${m.isActive ? '' : 'opacity-70'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-semibold">{m.fullName}</span>
                {m.id === me.id && <span className="text-slate-500">(את)</span>}
                <Badge color={m.role === 'admin' ? 'purple' : 'blue'}>{ROLE_LABELS[m.role]}</Badge>
                {!m.isActive && <Badge color="red">מושבתת</Badge>}
                {m.isActive && m.mustChangePassword && <Badge color="amber">עדיין לא נכנסה</Badge>}
              </div>
              <div className="mt-1 space-y-0.5 text-slate-600">
                <p dir="ltr" className="text-right">
                  {m.email}
                </p>
                {m.phone && <p dir="ltr" className="text-right">{formatPhone(m.phone)}</p>}
                <p>{activeCount(m.id)} לקוחות בתהליך</p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                <Button variant="secondary" size="sm" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setDialog({ member: m })}>
                  עריכה
                </Button>
                {m.id !== me.id && (
                  <>
                    <Button variant="secondary" size="sm" icon={<KeyRound className="h-4 w-4" aria-hidden />} onClick={() => resetPassword(m)} disabled={!m.isActive}>
                      איפוס סיסמה
                    </Button>
                    <Button variant={m.isActive ? 'ghost' : 'secondary'} size="sm" icon={<Power className="h-4 w-4" aria-hidden />} onClick={() => toggleActive(m)}>
                      {m.isActive ? 'השבתה' : 'הפעלה מחדש'}
                    </Button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <StaffDialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        member={dialog?.member ?? null}
        onCreated={(r) => setPasswordResult({ title: 'המשתמש נוצר', ...r })}
      />
      <PasswordResult result={passwordResult} onClose={() => setPasswordResult(null)} />
    </>
  );
}
