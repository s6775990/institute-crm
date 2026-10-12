import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Phone, Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '../../auth/AuthContext';
import { formatDate, formatPhone } from '../../core/format';
import { CLIENT_STATUS_LABELS } from '../../core/labels';
import { isAdmin } from '../../core/permissions';
import { useData } from '../../data/DataContext';
import type { ClientFilter } from '../../data/DataService';
import { lookupName, useLookups, useStaff, useStaffNames } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Badge, EmptyState, ErrorState, Loading, PageHeader } from '../../ui/common';
import { Input, Select } from '../../ui/Field';
import { NewClientDialog } from './ClientDialogs';

const VIEWS: { id: ClientFilter['status']; label: string }[] = [
  { id: 'active', label: 'בתהליך' },
  { id: 'ended', label: 'סיימו' },
  { id: 'all', label: 'הכל' },
];

export default function ClientsPage() {
  const data = useData();
  const me = useCurrentUser();
  const admin = isAdmin(me);
  const { data: lookups } = useLookups();
  const { data: staff } = useStaff();
  const names = useStaffNames();
  const [status, setStatus] = useState<ClientFilter['status']>('active');
  const [search, setSearch] = useState('');
  const [counselorId, setCounselorId] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [adding, setAdding] = useState(false);

  const query = useQuery({
    queryKey: ['clients', status, search, counselorId, includeArchived],
    queryFn: () => data.listClients({ status, search, counselorId: counselorId || undefined, includeArchived }),
  });

  return (
    <>
      <PageHeader
        title={admin ? 'לקוחות' : 'הלקוחות שלי'}
        subtitle={admin ? 'כל הלקוחות של המכון' : 'הלקוחות שמשויכות אלייך'}
        actions={
          admin && (
            <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setAdding(true)}>
              לקוחה חדשה
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <div className="flex gap-1 rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="סינון לפי מצב">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={status === v.id}
              onClick={() => setStatus(v.id)}
              className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2 font-medium transition md:flex-none ${
                status === v.id ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="relative md:w-64">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="חיפוש לפי שם או טלפון" aria-label="חיפוש לקוחות" className="ps-10" />
        </div>
        {admin && (
          <>
            <Select value={counselorId} onChange={(e) => setCounselorId(e.target.value)} aria-label="סינון לפי יועצת" className="md:w-52">
              <option value="">כל היועצות</option>
              {(staff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </Select>
            <label className="flex items-center gap-2 font-medium text-slate-700">
              <input type="checkbox" className="h-5 w-5 accent-brand-700" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
              להציג גם ארכיון
            </label>
          </>
        )}
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data!.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users className="h-12 w-12" aria-hidden />} title={search ? 'לא נמצאו לקוחות מתאימות' : 'אין לקוחות להצגה'}>
            {!admin && !search && 'כשהמנהלת תשייך אלייך לקוחה, היא תופיע כאן ותקבלי התראה.'}
          </EmptyState>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {query.data!.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
              <Link to={`/clients/${c.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold text-slate-900">{c.fullName}</span>
                  {c.status === 'active' ? (
                    c.stageId && <Badge color="blue">{lookupName(lookups?.clientStages, c.stageId)}</Badge>
                  ) : (
                    <Badge color={c.status === 'completed' ? 'green' : 'gray'}>{CLIENT_STATUS_LABELS[c.status]}</Badge>
                  )}
                  {c.archivedAt && <Badge color="amber">בארכיון</Badge>}
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                  {admin && <span>יועצת: {names(c.counselorId)}</span>}
                  {c.phone && <span dir="ltr">{formatPhone(c.phone)}</span>}
                  <span>התחילה ב-{formatDate(c.startedAt)}</span>
                </div>
              </Link>
              {c.phone && (
                <a href={`tel:${c.phone}`} className="rounded-full bg-brand-50 p-3 text-brand-700 hover:bg-brand-100" aria-label={`התקשרות אל ${c.fullName}`} title="התקשרות">
                  <Phone className="h-5 w-5" aria-hidden />
                </a>
              )}
              <ChevronLeft className="hidden h-5 w-5 text-slate-400 sm:block" aria-hidden />
            </li>
          ))}
        </ul>
      )}

      {admin && <NewClientDialog open={adding} onClose={() => setAdding(false)} />}
    </>
  );
}
