import { useQuery } from '@tanstack/react-query';
import { Bell, CalendarDays, ChevronLeft, Inbox, ListTodo, Plus, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatTime, formatWeekday, greeting, todayDateOnly, toDateOnly } from '../../core/format';
import { MEETING_MODE_LABELS } from '../../core/labels';
import { isAdmin } from '../../core/permissions';
import { useData } from '../../data/DataContext';
import type { UpcomingMeeting } from '../../data/DataService';
import { useNotifications } from '../../data/queries';
import { Button, ButtonLink } from '../../ui/Button';
import { Loading, PageHeader, Section } from '../../ui/common';
import { LeadDialog } from '../leads/LeadDialog';
import { splitTasks, TaskList } from '../tasks/TaskList';

function StatCard({ to, icon, label, value, tone = 'default' }: { to: string; icon: React.ReactNode; label: string; value: number | string; tone?: 'default' | 'alert' }) {
  return (
    <Link to={to} className="card flex items-center gap-4 p-4 transition hover:border-brand-300 hover:shadow">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${tone === 'alert' ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-700'}`}>{icon}</div>
      <div>
        <p className="text-3xl font-bold leading-none text-slate-900">{value}</p>
        <p className="mt-1 text-slate-600">{label}</p>
      </div>
    </Link>
  );
}

function groupByDay(meetings: UpcomingMeeting[]) {
  const groups = new Map<string, UpcomingMeeting[]>();
  for (const m of meetings) {
    const key = toDateOnly(new Date(m.startsAt));
    groups.set(key, [...(groups.get(key) ?? []), m]);
  }
  return [...groups.entries()];
}

export default function HomePage() {
  const data = useData();
  const me = useCurrentUser();
  const admin = isAdmin(me);
  const [addingLead, setAddingLead] = useState(false);

  const tasks = useQuery({ queryKey: ['tasks', 'list', me.id], queryFn: () => data.listTasks({}) });
  const meetings = useQuery({ queryKey: ['meetings', 'upcoming'], queryFn: () => data.listUpcomingMeetings(7) });
  const clients = useQuery({ queryKey: ['clients', 'active', '', '', false], queryFn: () => data.listClients({ status: 'active' }) });
  const leads = useQuery({ queryKey: ['leads', 'open', ''], queryFn: () => data.listLeads({ view: 'open' }), enabled: admin });
  const notifications = useNotifications();

  const groups = splitTasks(tasks.data ?? []);
  const dueNow = [...groups.overdue, ...groups.today];
  const unread = (notifications.data ?? []).filter((n) => !n.readAt);
  const today = todayDateOnly();

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${me.fullName.split(' ')[0]}`}
        subtitle={formatWeekday(new Date().toISOString())}
        actions={
          admin && (
            <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setAddingLead(true)}>
              ליד חדש
            </Button>
          )
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {admin && <StatCard to="/leads" icon={<Inbox className="h-6 w-6" aria-hidden />} label="לידים בטיפול" value={leads.data?.length ?? '–'} />}
        <StatCard to="/clients" icon={<Users className="h-6 w-6" aria-hidden />} label={admin ? 'תורמים פעילים' : 'התורמים הפעילים שלי'} value={clients.data?.length ?? '–'} />
        <StatCard
          to="/tasks"
          icon={<ListTodo className="h-6 w-6" aria-hidden />}
          label="משימות באיחור"
          value={tasks.data ? groups.overdue.length : '–'}
          tone={groups.overdue.length > 0 ? 'alert' : 'default'}
        />
        {!admin && <StatCard to="/notifications" icon={<Bell className="h-6 w-6" aria-hidden />} label="התראות חדשות" value={unread.length} />}
      </div>

      {unread.length > 0 && (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-bold text-brand-900">
            <Bell className="h-5 w-5" aria-hidden />
            יש לך {unread.length === 1 ? 'התראה חדשה' : `${unread.length} התראות חדשות`}
          </h2>
          <ul className="space-y-1">
            {unread.slice(0, 3).map((n) => (
              <li key={n.id}>
                <Link
                  to={n.clientId ? `/clients/${n.clientId}` : '/tasks'}
                  onClick={() => data.markNotificationRead(n.id).catch(() => undefined)}
                  className="font-medium text-brand-800 underline-offset-2 hover:underline"
                >
                  {n.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section
          title="מה צריך לעשות היום"
          actions={
            <ButtonLink to="/tasks" variant="ghost" size="sm">
              לכל המשימות
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </ButtonLink>
          }
        >
          {tasks.isLoading ? <Loading /> : <TaskList tasks={dueNow} showContext emptyText="אין משימות להיום. יום רגוע!" />}
        </Section>

        <Section title="שיחות מתוכננות לשבוע הקרוב">
          {meetings.isLoading ? (
            <Loading />
          ) : (meetings.data ?? []).length === 0 ? (
            <p className="py-3 text-slate-500">אין שיחות מתוכננות בשבוע הקרוב.</p>
          ) : (
            <div className="space-y-4">
              {groupByDay(meetings.data!).map(([day, items]) => (
                <div key={day}>
                  <h3 className="mb-2 flex items-center gap-2 font-bold text-slate-700">
                    <CalendarDays className="h-4 w-4" aria-hidden />
                    {day === today ? 'היום' : formatWeekday(items[0].startsAt)}
                  </h3>
                  <ul className="space-y-2">
                    {items.map((m) => (
                      <li key={m.id}>
                        <Link to={`/clients/${m.clientId}?tab=meetings`} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 hover:bg-slate-50">
                          <span className="w-14 shrink-0 text-lg font-bold text-brand-800">{formatTime(m.startsAt)}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-medium text-slate-900">{m.clientName}</span>
                            <span className="text-sm text-slate-600">{MEETING_MODE_LABELS[m.mode]}</span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {admin && <LeadDialog open={addingLead} onClose={() => setAddingLead(false)} />}
    </>
  );
}
