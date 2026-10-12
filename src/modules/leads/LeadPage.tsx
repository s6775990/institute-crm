import { useQuery } from '@tanstack/react-query';
import { Archive, ArrowRight, MessageCircle, Pencil, Phone, Plus, UserCheck } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { formatDate, formatPhone, whatsappNumber } from '../../core/format';
import { useData } from '../../data/DataContext';
import { lookupName, selectableItems, useLookups } from '../../data/queries';
import { Button, ButtonLink, buttonClass } from '../../ui/Button';
import { Badge, Detail, ErrorState, Loading, PageHeader, Section } from '../../ui/common';
import { useConfirm } from '../../ui/feedback';
import { Select } from '../../ui/Field';
import { useAction } from '../../ui/useSubmit';
import { ActivityLog } from '../activities/ActivityLog';
import { TaskDialog } from '../tasks/TaskDialog';
import { TaskList } from '../tasks/TaskList';
import { ConvertLeadDialog } from './ConvertLeadDialog';
import { LeadDialog } from './LeadDialog';

export default function LeadPage() {
  const { id = '' } = useParams();
  const data = useData();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { run } = useAction();
  const { data: lookups } = useLookups();
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);
  const [addingTask, setAddingTask] = useState(false);

  const leadQuery = useQuery({ queryKey: ['lead', id], queryFn: () => data.getLead(id) });
  const tasksQuery = useQuery({ queryKey: ['tasks', 'lead', id], queryFn: () => data.listTasks({ leadId: id }), enabled: leadQuery.isSuccess });

  if (leadQuery.isLoading) return <Loading />;
  if (leadQuery.error) return <ErrorState error={leadQuery.error} onRetry={() => leadQuery.refetch()} />;
  const lead = leadQuery.data!;
  const converted = lead.convertedClientId !== null;
  const status = lookups?.leadStatuses.find((s) => s.id === lead.statusId);

  const archive = async () => {
    const ok = await confirm({
      title: 'העברה לארכיון',
      message: `להעביר את ${lead.fullName} לארכיון? הליד לא יופיע יותר ברשימות. המידע לא נמחק.`,
      confirmLabel: 'כן, להעביר לארכיון',
      danger: true,
    });
    if (ok && (await run(() => data.archiveLead(lead.id), 'הליד הועבר לארכיון'))) navigate('/leads');
  };

  return (
    <>
      <Link to="/leads" className="mb-3 inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
        <ArrowRight className="h-4 w-4" aria-hidden />
        חזרה לרשימת הלידים
      </Link>

      <PageHeader
        title={lead.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {converted ? <Badge color="green">הפכה ללקוחה</Badge> : status && <Badge color={status.color}>{status.name}</Badge>}
            <span>פנתה ב-{formatDate(lead.createdAt)}</span>
          </span>
        }
        actions={
          <>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} className={buttonClass('secondary')}>
                <Phone className="h-5 w-5" aria-hidden />
                התקשרות
              </a>
            )}
            {lead.phone && (
              <a href={`https://wa.me/${whatsappNumber(lead.phone)}`} target="_blank" rel="noopener noreferrer" className={buttonClass('secondary')}>
                <MessageCircle className="h-5 w-5" aria-hidden />
                וואטסאפ
              </a>
            )}
            {!converted && (
              <Button icon={<UserCheck className="h-5 w-5" aria-hidden />} onClick={() => setConverting(true)}>
                הפיכה ללקוחה
              </Button>
            )}
          </>
        }
      />

      {converted && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="font-medium text-emerald-900">הליד הזה הפך ללקוחה ב-{formatDate(lead.convertedAt)}.</p>
          <ButtonLink to={`/clients/${lead.convertedClientId}`} variant="secondary" size="sm">
            לכרטיס הלקוחה
          </ButtonLink>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Section title="תיעוד שיחות ופניות">
            <ActivityLog parent={{ leadId: lead.id }} />
          </Section>
        </div>

        <div className="space-y-5">
          <Section
            title="פרטים"
            actions={
              <Button variant="ghost" size="sm" icon={<Pencil className="h-4 w-4" aria-hidden />} onClick={() => setEditing(true)}>
                עריכה
              </Button>
            }
          >
            <dl className="space-y-3">
              <Detail label="טלפון">{lead.phone && <span dir="ltr">{formatPhone(lead.phone)}</span>}</Detail>
              <Detail label="מייל">{lead.email}</Detail>
              <Detail label="איך הגיעה">{lookupName(lookups?.leadSources, lead.sourceId)}</Detail>
              <Detail label="במה מתעניינת">{lead.inquiry && <span className="whitespace-pre-wrap">{lead.inquiry}</span>}</Detail>
            </dl>
            {!converted && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <label htmlFor="lead-status" className="mb-1.5 block font-medium">
                  סטטוס
                </label>
                <Select
                  id="lead-status"
                  value={lead.statusId}
                  onChange={(e) => run(() => data.setLeadStatus(lead.id, e.target.value), 'הסטטוס עודכן')}
                >
                  {selectableItems(lookups?.leadStatuses, lead.statusId).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
          </Section>

          <Section
            title="מעקבים ומשימות"
            actions={
              <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAddingTask(true)}>
                הוספה
              </Button>
            }
          >
            {tasksQuery.isLoading ? <Loading /> : <TaskList tasks={tasksQuery.data ?? []} emptyText="אין מעקבים פתוחים" />}
          </Section>

          <Button variant="ghost" className="w-full text-slate-600" icon={<Archive className="h-5 w-5" aria-hidden />} onClick={archive}>
            העברת הליד לארכיון
          </Button>
        </div>
      </div>

      <LeadDialog open={editing} onClose={() => setEditing(false)} lead={lead} />
      <ConvertLeadDialog open={converting} onClose={() => setConverting(false)} lead={lead} />
      <TaskDialog open={addingTask} onClose={() => setAddingTask(false)} parent={{ leadId: lead.id }} />
    </>
  );
}
