// Shared read hooks. Every change in the data layer refreshes all queries
// (see DataProvider), so keys only need to be unique.

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import type { LookupItem, Profile } from '../core/types';
import { useData } from './DataContext';

export function useLookups() {
  const data = useData();
  return useQuery({ queryKey: ['lookups'], queryFn: () => data.getLookups(), staleTime: 60_000 });
}

export function useStaff() {
  const data = useData();
  return useQuery({ queryKey: ['staff'], queryFn: () => data.listStaff(), staleTime: 60_000 });
}

/** id → name map for showing who wrote what. */
export function useStaffNames(): (id: string | null | undefined) => string {
  const { data: staff } = useStaff();
  return useMemo(() => {
    const map = new Map((staff ?? []).map((s: Profile) => [s.id, s.fullName]));
    return (id) => (id ? map.get(id) ?? '' : '');
  }, [staff]);
}

export function useNotifications() {
  const data = useData();
  return useQuery({ queryKey: ['notifications'], queryFn: () => data.listNotifications(), refetchInterval: 60_000 });
}

export function lookupName(list: LookupItem[] | undefined, id: string | null): string {
  if (!id) return '';
  return list?.find((i) => i.id === id)?.name ?? '';
}

/** Active items, plus the currently selected one even if it was hidden later. */
export function selectableItems<T extends LookupItem>(list: T[] | undefined, currentId?: string | null): T[] {
  return (list ?? []).filter((i) => i.isActive || i.id === currentId);
}
