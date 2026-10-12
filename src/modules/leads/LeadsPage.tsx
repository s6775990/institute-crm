import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Inbox, Phone, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatPhone } from '../../core/format';
import { useData } from '../../data/DataContext';
import type { LeadFilter } from '../../data/DataService';
import { lookupName, useLookups } from '../../data/queries';
import { Button } from '../../ui/Button';
import { Badge, EmptyState, ErrorState, Loading, PageHeader } from '../../ui/common';
import { Input } from '../../ui/Field';
import { LeadDialog } from './LeadDialog';

const VIEWS: { id: LeadFilter['view']; label: string }[] = [
  { id: 'open', label: 'בטיפול' },
  { id: 'converted', label: 'הפכו לתורמים' },
  { id: 'lost', label: 'לא רלוונטיים' },
  { id: 'all', label: 'הכל' },
];

export default function LeadsPage() {
  const data = useData();
  const { data: lookups } = useLookups();
  const [view, setView] = useState<LeadFilter['view']>('open');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);
  const query = useQuery({ queryKey: ['leads', view, search], queryFn: () => data.listLeads({ view, search }) });

  return (
    <>
      <PageHeader
        title="לידים"
        subtitle="פניות של מתעניינים שעדיין לא תרמו"
        actions={
          <Button icon={<Plus className="h-5 w-5" aria-hidden />} onClick={() => setAdding(true)}>
            ליד חדש
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-200/70 p-1" role="tablist" aria-label="סינון לידים">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={view === v.id}
              onClick={() => setView(v.id)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 font-medium transition ${
                view === v.id ? 'bg-white text-brand-800 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש לפי שם או טלפון"
            aria-label="חיפוש לידים"
            className="ps-10"
          />
        </div>
      </div>

      {query.isLoading ? (
        <Loading />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data!.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Inbox className="h-12 w-12" aria-hidden />} title={search ? 'לא נמצאו לידים מתאימים' : 'אין לידים להצגה'}>
            {!search && view === 'open' && 'כשמתקבלת פנייה חדשה, לחצי על "ליד חדש".'}
          </EmptyState>
        </div>
      ) : (
        <ul className="card divide-y divide-slate-100">
          {query.data!.map((lead) => {
            const status = lookups?.leadStatuses.find((s) => s.id === lead.statusId);
            return (
              <li key={lead.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                <Link to={`/leads/${lead.id}`} className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-slate-900">{lead.fullName}</span>
                    {lead.convertedClientId ? (
                      <Badge color="green">הפך לתורם</Badge>
                    ) : (
                      status && <Badge color={status.color}>{status.name}</Badge>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    {lead.phone && <span dir="ltr">{formatPhone(lead.phone)}</span>}
                    {lead.sourceId && <span>מקור: {lookupName(lookups?.leadSources, lead.sourceId)}</span>}
                    <span>פנה ב-{formatDate(lead.createdAt)}</span>
                  </div>
                </Link>
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="rounded-full bg-brand-50 p-3 text-brand-700 hover:bg-brand-100"
                    aria-label={`התקשרות אל ${lead.fullName}`}
                    title="התקשרות"
                  >
                    <Phone className="h-5 w-5" aria-hidden />
                  </a>
                )}
                <ChevronLeft className="hidden h-5 w-5 text-slate-400 sm:block" aria-hidden />
              </li>
            );
          })}
        </ul>
      )}

      <LeadDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}
