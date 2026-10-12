import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROLE_LABELS } from '../../core/labels';
import type { Lead } from '../../core/types';
import { useData } from '../../data/DataContext';
import { selectableItems, useLookups, useStaff } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, FormError, Select, Textarea } from '../../ui/Field';
import { useSubmit } from '../../ui/useSubmit';

export function ConvertLeadDialog({ open, onClose, lead }: { open: boolean; onClose: () => void; lead: Lead }) {
  const data = useData();
  const navigate = useNavigate();
  const { data: staff } = useStaff();
  const { data: lookups } = useLookups();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [counselorId, setCounselorId] = useState('');
  const [stageId, setStageId] = useState('');
  const [note, setNote] = useState('');

  const stages = selectableItems(lookups?.clientStages);
  const counselors = (staff ?? []).filter((s) => s.isActive).sort((a, b) => (a.role === b.role ? 0 : a.role === 'counselor' ? -1 : 1));

  useEffect(() => {
    if (!open) return;
    reset();
    setCounselorId('');
    setStageId('');
    setNote(lead.inquiry ?? '');
  }, [open, lead, reset]);

  const save = async () => {
    const counselor = counselors.find((c) => c.id === counselorId);
    const result = await submit(
      () => data.convertLead(lead.id, { counselorId, stageId: stageId || null, noteForCounselor: note }),
      counselor ? `${lead.fullName} נוספה כלקוחה ושויכה ל${counselor.fullName}` : undefined,
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
      title={`הפיכת ${lead.fullName} ללקוחה`}
      description="ייפתח כרטיס לקוחה, והיועצת שתבחרי תקבל התראה."
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
      <Field label="איזו יועצת תלווה אותה?" error={errors.counselorId} required>
        <Select value={counselorId} onChange={(e) => setCounselorId(e.target.value)} autoFocus>
          <option value="" disabled>
            בחירת יועצת...
          </option>
          {counselors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.fullName}
              {c.role !== 'counselor' ? ` (${ROLE_LABELS[c.role]})` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="באיזה שלב מתחילים?" error={errors.stageId}>
        <Select value={stageId} onChange={(e) => setStageId(e.target.value)}>
          <option value="">{stages[0] ? `השלב הראשון (${stages[0].name})` : 'ללא שלב'}</option>
          {stages.slice(1).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field
        label="מה חשוב שהיועצת תדע?"
        error={errors.noteForCounselor}
        hint="היועצת לא רואה את פרטי הליד ואת השיחות שלך. מה שתכתבי כאן יופיע אצלה בכרטיס."
      >
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} />
      </Field>
    </Dialog>
  );
}
