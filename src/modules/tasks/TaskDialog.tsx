import { useEffect, useState } from 'react';
import { useCurrentUser } from '../../auth/AuthContext';
import { isAdmin } from '../../core/permissions';
import { todayDateOnly, toDateOnly } from '../../core/format';
import type { Task } from '../../core/types';
import { useData } from '../../data/DataContext';
import type { EntryParent } from '../../data/DataService';
import { useStaff } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { Field, FormError, Input, Select } from '../../ui/Field';
import { useSubmit } from '../../ui/useSubmit';

interface Props {
  open: boolean;
  onClose: () => void;
  parent: EntryParent | null;
  task?: Task | null;
  /** For client tasks: the client's counselor, who may be assigned besides admins. */
  clientCounselorId?: string;
}

function inDays(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

export function TaskDialog({ open, onClose, parent, task, clientCounselorId }: Props) {
  const data = useData();
  const me = useCurrentUser();
  const { data: staff } = useStaff();
  const { submit, pending, errors, formError, reset } = useSubmit();
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [assigneeId, setAssigneeId] = useState(me.id);

  useEffect(() => {
    if (!open) return;
    reset();
    setTitle(task?.title ?? '');
    setDueDate(task ? task.dueDate ?? '' : todayDateOnly());
    setAssigneeId(task?.assigneeId ?? me.id);
  }, [open, task, me.id, reset]);

  const canAssign = isAdmin(me);
  const assignable = (staff ?? []).filter((s) => {
    if (s.id === task?.assigneeId) return true;
    if (!s.isActive) return false;
    if (parent && 'leadId' in parent) return s.role === 'admin';
    if (parent && 'clientId' in parent) return s.role === 'admin' || s.id === clientCounselorId;
    return true;
  });

  const save = async () => {
    const input = { title, dueDate, assigneeId };
    const result = await submit(
      () => (task ? data.updateTask(task.id, input) : data.addTask(parent, input)),
      task ? 'המשימה עודכנה' : 'המשימה נוספה',
    );
    if (result.ok) onClose();
  };

  const quickDates: [string, string][] = [
    ['היום', inDays(0)],
    ['מחר', inDays(1)],
    ['בעוד שבוע', inDays(7)],
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      onSubmit={save}
      title={task ? 'עריכת משימה' : 'משימה חדשה'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            ביטול
          </Button>
          <Button type="submit" loading={pending}>
            {task ? 'שמירת השינויים' : 'הוספת המשימה'}
          </Button>
        </>
      }
    >
      <FormError>{Object.keys(errors).length ? null : formError}</FormError>
      <Field label="מה צריך לעשות?" error={errors.title} required>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: לחזור אליה בטלפון" autoFocus maxLength={200} />
      </Field>
      <Field label="עד מתי?" error={errors.dueDate} hint="אפשר להשאיר ריק אם אין תאריך">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
      <div className="-mt-2 flex flex-wrap gap-2">
        {quickDates.map(([label, value]) => (
          <Button key={label} size="sm" variant={dueDate === value ? 'primary' : 'secondary'} onClick={() => setDueDate(value)}>
            {label}
          </Button>
        ))}
      </div>
      {canAssign && (
        <Field label="למי המשימה?" error={errors.assigneeId}>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {assignable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.id === me.id ? `${s.fullName} (אני)` : s.fullName}
              </option>
            ))}
          </Select>
        </Field>
      )}
    </Dialog>
  );
}
