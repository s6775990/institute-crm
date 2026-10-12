import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Lead } from '../../core/types';
import { useData } from '../../data/DataContext';
import type { Duplicate } from '../../data/DataService';
import { selectableItems, useLookups } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, FormError, Input, Select, Textarea } from '../../ui/Field';
import { useSubmit } from '../../ui/useSubmit';

interface Props {
  open: boolean;
  onClose: () => void;
  lead?: Lead | null;
}

const empty = { fullName: '', phone: '', email: '', sourceId: '', statusId: '', inquiry: '' };

export function LeadDialog({ open, onClose, lead }: Props) {
  const data = useData();
  const navigate = useNavigate();
  const { data: lookups } = useLookups();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [form, setForm] = useState(empty);
  const [duplicates, setDuplicates] = useState<Duplicate[] | null>(null);

  useEffect(() => {
    if (!open) return;
    reset();
    setDuplicates(null);
    setForm(
      lead
        ? {
            fullName: lead.fullName,
            phone: lead.phone ?? '',
            email: lead.email ?? '',
            sourceId: lead.sourceId ?? '',
            statusId: lead.statusId,
            inquiry: lead.inquiry ?? '',
          }
        : empty,
    );
  }, [open, lead, reset]);

  const set = (key: keyof typeof empty) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (key === 'phone' || key === 'email') setDuplicates(null);
  };

  const save = async (skipDuplicateCheck = false) => {
    const input = { ...form, sourceId: form.sourceId || null, statusId: form.statusId || undefined };
    if (!skipDuplicateCheck) {
      const found = await submit(() => data.findDuplicates(form.phone, form.email, lead?.id));
      if (found.ok && found.value.length > 0) {
        setDuplicates(found.value);
        return;
      }
    }
    const result = await submit(
      () => (lead ? data.updateLead(lead.id, input).then(() => lead) : data.createLead(input)),
      lead ? 'פרטי הליד עודכנו' : 'הליד נוסף בהצלחה',
    );
    if (result.ok) {
      onClose();
      if (!lead) navigate(`/leads/${result.value.id}`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={() => save(duplicates !== null)}
      title={lead ? 'עריכת פרטי ליד' : 'ליד חדש'}
      description={lead ? undefined : 'מספיק שם וטלפון או מייל. את השאר אפשר להשלים אחר כך.'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            {duplicates ? 'לשמור בכל זאת' : lead ? 'שמירת השינויים' : 'שמירת הליד'}
          </Button>
        </>
      }
    >
      {duplicates && duplicates.length > 0 && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900">
          <p className="font-bold">שימי לב: כבר קיימים במערכת פרטים עם אותו טלפון או מייל:</p>
          <ul className="mt-2 list-inside list-disc">
            {duplicates.map((d) => (
              <li key={d.id}>
                <Link
                  to={d.type === 'lead' ? `/leads/${d.id}` : `/clients/${d.id}`}
                  className="font-medium underline"
                  onClick={onClose}
                >
                  {d.type === 'lead' ? 'ליד' : 'לקוחה'}: {d.fullName}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2">אם זו אותה אישה, עדיף לפתוח את הכרטיס הקיים. אם לא, אפשר לשמור בכל זאת.</p>
        </div>
      )}
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <Field label="שם מלא" error={errors.fullName} required>
        <Input value={form.fullName} onChange={set('fullName')} autoFocus autoComplete="off" maxLength={100} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="טלפון" error={errors.phone}>
          <Input type="tel" inputMode="tel" dir="ltr" className="text-right" value={form.phone} onChange={set('phone')} placeholder="050-1234567" />
        </Field>
        <Field label="מייל" error={errors.email}>
          <Input type="email" dir="ltr" className="text-right" value={form.email} onChange={set('email')} placeholder="name@gmail.com" />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="איך הגיעה אלינו?" error={errors.sourceId}>
          <Select value={form.sourceId} onChange={set('sourceId')}>
            <option value="">לא ידוע</option>
            {selectableItems(lookups?.leadSources, form.sourceId).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </Field>
        {lead && !lead.convertedClientId && (
          <Field label="סטטוס" error={errors.statusId}>
            <Select value={form.statusId} onChange={set('statusId')}>
              {selectableItems(lookups?.leadStatuses, form.statusId).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>
      <Field label="במה היא מתעניינת?" error={errors.inquiry} hint="מה סיפרה בפנייה, מה היא מחפשת">
        <Textarea value={form.inquiry} onChange={set('inquiry')} rows={3} />
      </Field>
    </Dialog>
  );
}
