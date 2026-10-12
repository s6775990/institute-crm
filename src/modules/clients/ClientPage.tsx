import { useQuery } from '@tanstack/react-query';
import { Archive, ArchiveRestore, ArrowRight, Check, MessageCircle, Pencil, Phone, Plus, UserCog } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatDate, formatDateTime, formatPhone, whatsappNumber } from '../../core/format';
import { CLIENT_STATUS_LABELS } from '../../core/labels';
import { can, isAdmin } from '../../core/permissions';
import type { Client } from '../../core/types';
import { useData } from '../../data/DataContext';
import { lookupName, selectableItems, useLookups, useStaffNames } from '../../data/queries';
import { Button, buttonClass } from '../../ui/Button';
import { Badge, Detail, ErrorState, Loading, PageHeader, Section } from '../../ui/common';
import { useConfirm } from '../../ui/feedback';
import { useAction } from '../../ui/useSubmit';
import { ActivityLog } from '../activities/ActivityLog';
import { TaskDialog } from '../tasks/TaskDialog';
import { TaskList } from '../tasks/TaskList';
import { AssessmentsTab } from './AssessmentsTab';
import { AssignClientDialog, EditClientDialog } from './ClientDialogs';
import { ClosingTab } from './ClosingTab';
import { MeetingsTab } from './MeetingsTab';

const TABS = [
  { id: 'overview', label: 'סקירה' },
  { id: 'meetings', label: 'פגישות וסיכומים' },
  { id: 'activity', label: 'תיעוד שיחות' },
  { id: 'assessments', label: 'אבחונים' },
  { id: 'tasks', label: 'משימות' },
  { id: 'closing', label: 'סיום ומשוב' },
] as const;
type TabId = (typeof TABS)[number]['id'];

function StageProgress({ client, editable }: { client: Client; editable: boolean }) {
  const data = useData();
  const { run } = useAction();
  const { data: lookups } = useLookups();
  const names = useStaffNames();
  const stages = selectableItems(lookups?.clientStages, client.stageId);
  const currentIndex = stages.findIndex((s) => s.id === client.stageId);
  const history = useQuery({ queryKey: ['stageHistory', client.id], queryFn: () => data.listStageHistory(client.id) });

  return (
    <Section title="שלבי התהליך">
      <ol className="space-y-2">
        {stages.map((stage, i) => {
          const isCurrent = stage.id === client.stageId;
          const isPast = currentIndex >= 0 && i < currentIndex;
          return (
            <li key={stage.id}>
              <button
                type="button"
                disabled={!editable || isCurrent}
                onClick={() => run(() => data.setClientStage(client.id, stage.id), `השלב עודכן ל"${stage.name}"`)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-start transition ${
                  isCurrent
                    ? 'border-brand-600 bg-brand-50 font-bold text-brand-900'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50 disabled:hover:border-transparent disabled:hover:bg-transparent'
                }`}
                aria-current={isCurrent ? 'step' : undefined}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    isCurrent ? 'bg-brand-700 text-white' : isPast ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isPast ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
                </span>
                <span className="flex-1">{stage.name}</span>
                {isCurrent && <span className="text-sm font-medium text-brand-700">השלב הנוכחי</span>}
              </button>
            </li>
          );
        })}
      </ol>
      {editable && <p className="mt-3 text-sm text-slate-500">כדי לעבור שלב, לחצי על השלב הרצוי.</p>}
      {(history.data ?? []).length > 1 && (
        <details className="mt-4 border-t border-slate-100 pt-3">
          <summary className="cursor-pointer font-medium text-slate-700">היסטוריית מעבר בין שלבים</summary>
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {history.data!.map((h) => (
              <li key={h.id}>
                {formatDateTime(h.changedAt)} – {lookupName(lookups?.clientStages, h.toStageId) || 'ללא שלב'} ({names(h.changedBy)})
              </li>
            ))}
          </ul>
        </details>
      )}
    </Section>
  );
}

function NextMeeting({ clientId, onOpen }: { clientId: string; onOpen: () => void }) {
  const data = useData();
  const query = useQuery({ queryKey: ['meetings', clientId], queryFn: () => data.listMeetings(clientId) });
  const now = new Date().toISOString();
  const next = (query.data ?? []).filter((m) => m.status === 'scheduled' && m.startsAt >= now).sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  return (
    <Detail label="הפגישה הבאה">
      {next ? (
        <button type="button" className="font-medium text-brand-700 hover:underline" onClick={onOpen}>
          {formatDateTime(next.startsAt)}
        </button>
      ) : (
        <span className="text-slate-500">לא נקבעה</span>
      )}
    </Detail>
  );
}

export default function ClientPage() {
  const { id = '' } = useParams();
  const data = useData();
  const me = useCurrentUser();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { run } = useAction();
  const names = useStaffNames();
  const { data: lookups } = useLookups();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'overview') as TabId;
  const setTab = (t: TabId) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true });
  const [editing, setEditing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const query = useQuery({ queryKey: ['client', id], queryFn: () => data.getClient(id) });
  const tasksQuery = useQuery({ queryKey: ['tasks', 'client', id], queryFn: () => data.listTasks({ clientId: id }), enabled: query.isSuccess });

  if (query.isLoading) return <Loading />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const client = query.data!;
  const admin = isAdmin(me);
  const editable = can.editClientContent(me, client);
  const openTasks = (tasksQuery.data ?? []).filter((t) => !t.completedAt).length;

  const archive = async () => {
    const ok = await confirm({
      title: 'העברה לארכיון',
      message: `להעביר את ${client.fullName} לארכיון? הכרטיס יוסתר מהיועצת ומהרשימות, אבל שום מידע לא יימחק ואפשר להחזיר אותו.`,
      confirmLabel: 'כן, להעביר לארכיון',
      danger: true,
    });
    if (ok && (await run(() => data.archiveClient(client.id), 'הלקוחה הועברה לארכיון'))) navigate('/clients');
  };

  return (
    <>
      <Link to="/clients" className="mb-3 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
        <ArrowRight className="h-4 w-4" aria-hidden />
        חזרה לרשימת הלקוחות
      </Link>

      {client.archivedAt && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="font-medium text-amber-900">הכרטיס הזה בארכיון מתאריך {formatDate(client.archivedAt)}. הוא מוסתר מהיועצת.</p>
          <Button variant="secondary" size="sm" icon={<ArchiveRestore className="h-4 w-4" aria-hidden />} onClick={() => run(() => data.restoreClient(client.id), 'הלקוחה הוחזרה מהארכיון')}>
            החזרה מהארכיון
          </Button>
        </div>
      )}

      <PageHeader
        title={client.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Badge color={client.status === 'active' ? 'blue' : client.status === 'completed' ? 'green' : 'gray'}>{CLIENT_STATUS_LABELS[client.status]}</Badge>
            {client.stageId && client.status === 'active' && <span>שלב: {lookupName(lookups?.clientStages, client.stageId)}</span>}
            <span>· יועצת: {names(client.counselorId)}</span>
          </span>
        }
        actions={
          <>
            {client.phone && (
              <a href={`tel:${client.phone}`} className={buttonClass('secondary')}>
                <Phone className="h-5 w-5" aria-hidden />
                התקשרות
              </a>
            )}
            {client.phone && (
              <a href={`https://wa.me/${whatsappNumber(client.phone)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
                <MessageCircle className="h-5 w-5" aria-hidden />
                וואטסאפ
              </a>
            )}
          </>
        }
      />

      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="חלקי הכרטיס">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium transition ${
                tab === t.id ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t.label}
              {t.id === 'tasks' && openTasks > 0 && <span className="ms-1.5 rounded-full bg-brand-700 px-2 text-sm text-white">{openTasks}</span>}
            </button>
          ))}
        </div>
      </div>

      <div role="tabpanel">
        {tab === 'overview' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-5">
              <Section
                title="פרטים"
                actions={
                  editable && (
                    <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(true)}>
                      עריכה
                    </Button>
                  )
                }
              >
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Detail label="טלפון">{client.phone && <span dir="ltr">{formatPhone(client.phone)}</span>}</Detail>
                  <Detail label="מייל">{client.email}</Detail>
                  <Detail label="תחילת התהליך">{formatDate(client.startedAt)}</Detail>
                  <NextMeeting clientId={client.id} onOpen={() => setTab('meetings')} />
                  <Detail label="יועצת מלווה">{names(client.counselorId)}</Detail>
                  {admin && client.leadId && (
                    <Detail label="הגיעה כליד">
                      <Link to={`/leads/${client.leadId}`} className="text-brand-700 hover:underline">
                        לכרטיס הליד
                      </Link>
                    </Detail>
                  )}
                </dl>
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <Detail label="רקע ומה חשוב לדעת">{client.background && <span className="whitespace-pre-wrap leading-relaxed">{client.background}</span>}</Detail>
                </div>
              </Section>

              {admin && (
                <Section title="פעולות ניהול">
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" icon={<UserCog className="h-5 w-5" aria-hidden />} onClick={() => setAssigning(true)}>
                      החלפת יועצת
                    </Button>
                    {!client.archivedAt && (
                      <Button variant="ghost" icon={<Archive className="h-5 w-5" aria-hidden />} onClick={archive}>
                        העברה לארכיון
                      </Button>
                    )}
                  </div>
                </Section>
              )}
            </div>
            <StageProgress client={client} editable={editable && client.status === 'active'} />
          </div>
        )}
        {tab === 'meetings' && (
          <Section title="פגישות וסיכומים">
            <MeetingsTab client={client} editable={editable} />
          </Section>
        )}
        {tab === 'activity' && (
          <Section title="תיעוד שיחות והודעות">
            <ActivityLog parent={{ clientId: client.id }} readOnly={!editable} />
          </Section>
        )}
        {tab === 'assessments' && (
          <Section title="אבחונים">
            <AssessmentsTab client={client} editable={editable} />
          </Section>
        )}
        {tab === 'tasks' && (
          <Section
            title="משימות"
            actions={
              editable && (
                <Button size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAddingTask(true)}>
                  משימה חדשה
                </Button>
              )
            }
          >
            {tasksQuery.isLoading ? (
              <Loading />
            ) : (
              <TaskList tasks={tasksQuery.data ?? []} showAssignee={admin} clientCounselorId={client.counselorId} emptyText="אין משימות ללקוחה הזו" />
            )}
          </Section>
        )}
        {tab === 'closing' && <ClosingTab client={client} editable={editable} />}
      </div>

      <EditClientDialog open={editing} onClose={() => setEditing(false)} client={client} />
      {admin && <AssignClientDialog open={assigning} onClose={() => setAssigning(false)} client={client} />}
      <TaskDialog open={addingTask} onClose={() => setAddingTask(false)} parent={{ clientId: client.id }} clientCounselorId={client.counselorId} />
    </>
  );
}
