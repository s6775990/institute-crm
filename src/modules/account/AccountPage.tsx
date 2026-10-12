import { useState } from 'react';
import { useAuth, useCurrentUser } from '../../auth/AuthContext';
import { ROLE_LABELS } from '../../core/labels';
import { PASSWORD_MIN_LENGTH } from '../../core/validation';
import { useData } from '../../data/DataContext';
import { Button } from '../../ui/Button';
import { Detail, PageHeader, Section } from '../../ui/common';
import { Field, FormError, Input } from '../../ui/Field';
import { useSubmit } from '../../ui/useSubmit';

export function PasswordForm({ onDone, submitLabel = 'שמירת הסיסמה' }: { onDone?: () => void; submitLabel?: string }) {
  const data = useData();
  const { refresh } = useAuth();
  const { submit, pending, errors, formError } = useSubmit();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const r = await submit(() => data.changePassword(password, confirm), 'הסיסמה עודכנה');
        if (r.ok) {
          setPassword('');
          setConfirm('');
          await refresh();
          onDone?.();
        }
      }}
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <Field label="סיסמה חדשה" error={errors.password} hint={`לפחות ${PASSWORD_MIN_LENGTH} תווים. אפשר גם ספרות בלבד.`} required>
        <Input type="password" autoComplete="new-password" dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field label="הקלדה חוזרת של הסיסמה" error={errors.confirm} required>
        <Input type="password" autoComplete="new-password" dir="ltr" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <Button type="submit" loading={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}

export default function AccountPage() {
  const me = useCurrentUser();
  const data = useData();
  const { refresh } = useAuth();
  const { submit, pending, errors, formError } = useSubmit();
  const [fullName, setFullName] = useState(me.fullName);
  const [phone, setPhone] = useState(me.phone ?? '');

  return (
    <>
      <PageHeader title="החשבון שלי" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="הפרטים שלי">
          <dl className="mb-4 grid gap-3 sm:grid-cols-2">
            <Detail label="מייל לכניסה">{<span dir="ltr">{me.email}</span>}</Detail>
            <Detail label="תפקיד">{ROLE_LABELS[me.role]}</Detail>
          </dl>
          <form
            noValidate
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const r = await submit(() => data.updateMyProfile({ fullName, phone }), 'הפרטים נשמרו');
              if (r.ok) await refresh();
            }}
          >
            <FormError>{Object.keys(errors).length ? null : formError}</FormError>
            <Field label="שם מלא" error={errors.fullName} required>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="טלפון" error={errors.phone}>
              <Input type="tel" dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Button type="submit" loading={pending}>
              שמירת הפרטים
            </Button>
          </form>
        </Section>
        <Section title="החלפת סיסמה">
          <PasswordForm />
        </Section>
      </div>
    </>
  );
}
