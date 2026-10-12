import { Bell, CheckCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDateTime } from '../../core/format';
import type { AppNotification } from '../../core/types';
import { useData } from '../../data/DataContext';
import { useNotifications } from '../../data/queries';
import { Button } from '../../ui/Button';
import { EmptyState, ErrorState, Loading, PageHeader } from '../../ui/common';
import { useAction } from '../../ui/useSubmit';

export default function NotificationsPage() {
  const data = useData();
  const navigate = useNavigate();
  const { run, pending } = useAction();
  const query = useNotifications();
  const unread = (query.data ?? []).filter((n) => !n.readAt).length;

  const open = async (n: AppNotification) => {
    if (!n.readAt) await run(() => data.markNotificationRead(n.id));
    navigate(n.clientId ? `/clients/${n.clientId}` : '/tasks');
  };

  return (
    <>
      <PageHeader
        title="התראות"
        actions={
          unread > 0 && (
            <Button variant="secondary" loading={pending} icon={<CheckCheck className="h-5 w-5" aria-hidden />} onClick={() => run(() => data.markAllNotificationsRead(), 'כל ההתראות סומנו כנקראו')}>
              סימון הכל כנקרא
            </Button>
          )
        }
      />
      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data!.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Bell className="h-12 w-12" aria-hidden />} title="אין התראות" />
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {query.data!.map((n) => (
            <li key={n.id}>
              <button type="button" onClick={() => open(n)} className="flex w-full items-start gap-3 px-4 py-4 text-start hover:bg-slate-50">
                <span className={`mt-2 h-3 w-3 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-brand-600'}`} aria-hidden />
                <span className="flex-1">
                  <span className={`block ${n.readAt ? 'text-slate-700' : 'font-bold text-slate-900'}`}>{n.title}</span>
                  <span className="text-sm text-slate-500">{formatDateTime(n.createdAt)}</span>
                </span>
                {!n.readAt && <span className="sr-only">(חדשה)</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
