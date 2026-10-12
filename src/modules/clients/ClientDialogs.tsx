// Dialogs for creating a client directly, editing details and changing the counselor.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Client } from '../../core/types';
import { useData } from '../../data/DataContext';
import { selectableItems, useLookups, useStaff } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, FormError, Input, Select, Textarea } from '../../ui/Field';
import { useSubmit } from '../../ui/useSubmit';

function useActiveStaff() {
  const { data: staff } = useStaff();
  return (staff ?? []).filter((s) => s.isActive).sort((a, b) => (a.role === b.role ? 0 : a.role === 'counselor' ? -1 : 1));
}

function ContactFields({
  form,
  set,
  errors,
}: {
  form: { fullName: string; phone: string; email: string; background: string };
  set: (key: 'fullName' | 'phone' | 'email' | 'background') => (e: { target: { value: string } }) => void;
  errors: Record<string, string>;
}) {
  return (
    <>
      <Field label="שם מלא" error={errors.fullName} required>
        <Input value={form.fullName} onChange={set('fullName')} autoFocus maxLength={100} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="טלפון" error={errors.phone}>
          <Input type="tel" inputMode="tel" dir="ltr" className="text-right" value={form.phone} onChange={set('phone')} placeholder="050-1234567" />
        </Field>
        <Field label="מייל" error={errors.email}>
          <Input type="email" dir="ltr" className="text-right" value={form.email} onChange={set('email')} placeholder="name@gmail.com" />
        </Field>
      </div>
      <Field label="רקע ומה חשוב לדעת" error={errors.background}>
        <Textarea value={form.background} onChange={set('background')} rows={4} />
      </Field>
    </>
  );
}

export function EditClientDialog({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const data = useData();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', background: '' });

  useEffect(() => {
    if (!open) return;
    reset();
    setForm({ fullName: client.fullName, phone: client.phone ?? '', email: client.email ?? '', background: client.background ?? '' });
  }, [open, client, reset]);

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async () => {
    const result = await submit(() => data.updateClientDetails(client.id, form), 'הפרטים נשמרו');
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      title="עריכת פרטי הלקוחה"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            שמירת השינויים
          </Button>
        </>
      }
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <ContactFields form={form} set={set} errors={errors} />
    </Dialog>
  );
}

const EMPTY_NEW_CLIENT = { fullName: '', phone: '', email: '', background: '', counselorId: '', stageId: '' };

export function NewClientDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const data = useData();
  const navigate = useNavigate();
  const { data: lookups } = useLookups();
  const staff = useActiveStaff();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [form, setForm] = useState(EMPTY_NEW_CLIENT);

  useEffect(() => {
    if (!open) return;
    reset();
    setForm(EMPTY_NEW_CLIENT);
  }, [open, reset]);

  const set = (key: keyof typeof EMPTY_NEW_CLIENT) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const stages = selectableItems(lookups?.clientStages);

  const save = async () => {
    const result = await submit(
      () => data.createClient({ ...form, stageId: form.stageId || stages[0]?.id || null }),
      'הלקוחה נוספה',
    );
    if (result.ok) {
      onClose();
      navigate(`/clients/${result.value.id}`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      title="לקוחה חדשה"
      description='לקוחה שהגיעה כליד – עדיף להפוך אותה ללקוחה ממסך הלידים, כדי לשמור את ההיסטוריה.'
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            יצירת כרטיס לקוחה
          </Button>
        </>
      }
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <ContactFields form={form} set={set} errors={errors} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="יועצת מלווה" error={errors.counselorId} required>
          <Select value={form.counselorId} onChange={set('counselorId')}>
            <option value="" disabled>
              בחירת יועצת...
            </option>
            {staff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="שלב בתהליך" error={errors.stageId}>
          <Select value={form.stageId} onChange={set('stageId')}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}

export function AssignClientDialog({ open, onClose, client }: { open: boolean; onClose: () => void; client: Client }) {
  const data = useData();
  const staff = useActiveStaff();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [counselorId, setCounselorId] = useState(client.counselorId);

  useEffect(() => {
    if (!open) return;
    reset();
    setCounselorId(client.counselorId);
  }, [open, client, reset]);

  const save = async () => {
    const next = staff.find((s) => s.id === counselorId);
    const result = await submit(
      () => data.assignClient(client.id, counselorId),
      next ? `${client.fullName} שויכה ל${next.fullName}` : undefined,
    );
    if (result.ok) onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      title="החלפת יועצת"
      description="היועצת החדשה תקבל התראה ותראה את כל הכרטיס. היועצת הקודמת לא תראה אותו יותר."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending} disabled={counselorId === client.counselorId}>
            שמירה
          </Button>
        </>
      }
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <Field label="יועצת מלווה" error={errors.counselorId}>
        <Select value={counselorId} onChange={(e) => setCounselorId(e.target.value)} autoFocus>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.fullName}
              {s.id === client.counselorId ? ' (נוכחית)' : ''}
            </option>
          ))}
        </Select>
      </Field>
    </Dialog>
  );
}
