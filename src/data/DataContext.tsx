import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ErrorState, Loading } from '../ui/common';
import type { DataService } from './DataService';
import { LocalDataService } from './local/LocalDataService';
import { IndexedDbBlobStore } from './local/storage';

interface DataContextValue {
  data: DataService;
  /** Present only in demo mode (browser storage). */
  demo: LocalDataService | null;
}

const DataContext = createContext<DataContextValue | null>(null);

async function createService(): Promise<DataContextValue> {
  // The database connection will be chosen here once it exists.
  const local = await LocalDataService.create({
    kv: window.localStorage,
    blobs: new IndexedDbBlobStore('crm-demo-files'),
  });
  return { data: local, demo: local };
}

export function DataProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState<DataContextValue | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    createService().then(setValue, setError);
  }, []);

  useEffect(() => {
    if (!value) return;
    // Any change refreshes what is on screen.
    const unsubscribe = value.data.subscribe(() => queryClient.invalidateQueries());
    // Changes made in another tab of the same browser.
    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith('crm.demo.')) value.demo?.reloadFromStorage();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      unsubscribe();
      window.removeEventListener('storage', onStorage);
    };
  }, [value, queryClient]);

  if (error) return <div className="p-6"><ErrorState error={error} onRetry={() => window.location.reload()} /></div>;
  if (!value) return <Loading label="טוען את המערכת..." />;
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}

export const useData = () => useDataContext().data;
export const useDemo = () => useDataContext().demo;
