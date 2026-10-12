import { useQuery } from '@tanstack/react-query';
import { ListTodo, Plus } from 'lucide-react';
import { useState } from 'react';
import { useCurrentUser } from '../../auth/AuthContext';
import { isAdmin } from '../../core/permissions';
import { useData } from '../../data/DataContext';
import { useStaff } from '../../data/queries';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Loading, PageHeader, Section } from '../../ui/common';
import { Select } from '../../ui/Field';
import { splitTasks, TaskList } from './TaskList';
import { TaskDialog } from './TaskDialog';

export default function TasksPage() {
  const data = useData();
  const me = useCurrentUser();
  const admin = isAdmin(me);
  const { data: staff } = useStaff();
  const [assignee, setAssignee] = useState<string>(me.id);
  const [adding, setAdding] = useState(false);

  const query = useQuery({
    queryKey: ['tasks', 'list', assignee],
    queryFn: () => data.listTasks({ assigneeId: assignee }),
  });

  const groups = splitTasks(query.data ?? []);
  const showAssignee = admin && assignee !== me.id;

  return (
    <>
      <PageHeader
        title="משימות"
        subtitle="כל מה שצריך לעשות, לפי תאריכים"
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setAdding(true)}>
            משימה חדשה
          </Button>
        }
      />

      {admin && (
        <div className="mb-4 max-w-xs">
          <label className="mb-1.5 block font-medium" htmlFor="assignee-filter">
            משימות של:
          </label>
          <Select id="assignee-filter" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value={me.id}>המשימות שלי</option>
            <option value="all">כל הצוות</option>
            {(staff ?? [])
              .filter((s) => s.id !== me.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
          </Select>
        </div>
      )}

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <div className="card">
          <EmptyState icon={<ListTodo className="h-12 w-12" aria-hidden />} title="אין משימות כרגע">
            כדי להוסיף משימה, לחצי על "משימה חדשה".
          </EmptyState>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.overdue.length > 0 && (
            <Section title={`באיחור (${groups.overdue.length})`} className="border-red-200">
              <TaskList tasks={groups.overdue} showContext showAssignee={showAssignee} />
            </Section>
          )}
          <Section title={`להיום (${groups.today.length})`}>
            <TaskList tasks={groups.today} showContext showAssignee={showAssignee} emptyText="אין משימות להיום" />
          </Section>
          <Section title={`בהמשך (${groups.later.length})`}>
            <TaskList tasks={groups.later} showContext showAssignee={showAssignee} emptyText="אין משימות עתידיות" />
          </Section>
          {groups.done.length > 0 && (
            <details className="card p-4 sm:p-5">
              <summary className="cursor-pointer text-lg font-bold text-slate-700">משימות שבוצעו ({groups.done.length})</summary>
              <div className="mt-3">
                <TaskList tasks={groups.done} showContext showAssignee={showAssignee} />
              </div>
            </details>
          )}
        </div>
      )}

      <TaskDialog open={adding} onClose={() => setAdding(false)} parent={null} />
    </>
  );
}
