import { useQuery } from '@tanstack/react-query';
import { Check, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { relativeDay, todayDateOnly } from '../../core/format';
import { can, isAdmin } from '../../core/permissions';
import type { Task } from '../../core/types';
import { useData } from '../../data/DataContext';
import { useStaffNames } from '../../data/queries';
import { Badge } from '../../ui/common';
import { useConfirm } from '../../ui/feedback';
import { useAction } from '../../ui/useSubmit';
import { TaskDialog } from './TaskDialog';

/** Names of the clients/leads tasks point to, for "related to" links. */
function useContextNames(enabled: boolean) {
  const data = useData();
  const me = useCurrentUser();
  const clients = useQuery({
    queryKey: ['clients', 'names'],
    queryFn: () => data.listClients({ status: 'all' }),
    enabled,
  });
  const leads = useQuery({
    queryKey: ['leads', 'names'],
    queryFn: () => data.listLeads({ view: 'all' }),
    enabled: enabled && isAdmin(me),
  });
  return (task: Task): { to: string; name: string } | null => {
    if (task.clientId) {
      const c = clients.data?.find((x) => x.id === task.clientId);
      return c ? { to: `/clients/${c.id}`, name: c.fullName } : null;
    }
    if (task.leadId) {
      const l = leads.data?.find((x) => x.id === task.leadId);
      return l ? { to: `/leads/${l.id}`, name: `ליד: ${l.fullName}` } : null;
    }
    return null;
  };
}

interface Props {
  tasks: Task[];
  /** Show which client/lead each task belongs to (on general task screens). */
  showContext?: boolean;
  showAssignee?: boolean;
  clientCounselorId?: string;
  emptyText?: string;
}

export function TaskList({ tasks, showContext = false, showAssignee = false, clientCounselorId, emptyText = 'אין משימות' }: Props) {
  const data = useData();
  const me = useCurrentUser();
  const confirm = useConfirm();
  const { run } = useAction();
  const names = useStaffNames();
  const contextOf = useContextNames(showContext);
  const [editing, setEditing] = useState<Task | null>(null);
  const today = todayDateOnly();

  if (tasks.length === 0) return <p className="py-3 text-slate-500">{emptyText}</p>;

  const remove = async (task: Task) => {
    const ok = await confirm({
      title: 'מחיקת משימה',
      message: `למחוק את המשימה "${task.title}"?`,
      confirmLabel: 'כן, למחוק',
      danger: true,
    });
    if (ok) await run(() => data.deleteTask(task.id), 'המשימה נמחקה');
  };

  return (
    <>
      <ul className="divide-y divide-slate-100">
        {tasks.map((task) => {
          const done = task.completedAt !== null;
          const overdue = !done && task.dueDate !== null && task.dueDate < today;
          const dueToday = !done && task.dueDate === today;
          const ctx = showContext ? contextOf(task) : null;
          const mayModify = can.modifyEntry(me, task);
          return (
            <li key={task.id} className="flex items-start gap-3 py-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={done ? `לסמן שהמשימה "${task.title}" לא בוצעה` : `לסמן שהמשימה "${task.title}" בוצעה`}
                onClick={() => run(() => data.setTaskDone(task.id, !done), done ? undefined : 'כל הכבוד! המשימה סומנה כבוצעה')}
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition ${
                  done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-400 bg-white hover:border-brand-600'
                }`}
              >
                {done && <Check className="h-5 w-5" aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${done ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{task.title}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                  {task.dueDate && !done && (
                    <Badge color={overdue ? 'red' : dueToday ? 'amber' : 'gray'}>
                      {overdue ? `באיחור – ${relativeDay(task.dueDate)}` : relativeDay(task.dueDate)}
                    </Badge>
                  )}
                  {ctx && (
                    <Link to={ctx.to} className="font-medium text-brand-700 underline-offset-2 hover:underline">
                      {ctx.name}
                    </Link>
                  )}
                  {showAssignee && <span>אחראית: {names(task.assigneeId)}</span>}
                </div>
              </div>
              {mayModify && (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => setEditing(task)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    aria-label={`עריכת המשימה ${task.title}`}
                    title="עריכה"
                  >
                    <Pencil className="h-5 w-5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(task)}
                    className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"
                    aria-label={`מחיקת המשימה ${task.title}`}
                    title="מחיקה"
                  >
                    <Trash2 className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <TaskDialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        task={editing}
        parent={editing?.leadId ? { leadId: editing.leadId } : editing?.clientId ? { clientId: editing.clientId } : null}
        clientCounselorId={clientCounselorId}
      />
    </>
  );
}

export function splitTasks(tasks: Task[]) {
  const today = todayDateOnly();
  const open = tasks.filter((t) => !t.completedAt);
  return {
    overdue: open.filter((t) => t.dueDate !== null && t.dueDate < today),
    today: open.filter((t) => t.dueDate === today),
    later: open.filter((t) => t.dueDate === null || t.dueDate > today),
    done: tasks.filter((t) => t.completedAt),
  };
}
