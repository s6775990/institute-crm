import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { authEvents } from './auth/authEvents';
import ChangePasswordPage from './auth/ChangePasswordPage';
import LoginPage from './auth/LoginPage';
import { AppError } from './core/errors';
import type { Role } from './core/types';
import { DataProvider } from './data/DataContext';
import { AppShell } from './layout/AppShell';
import { MODULES } from './modules/registry';
import { EmptyState, Loading } from './ui/common';
import { ButtonLink } from './ui/Button';
import { FeedbackProvider } from './ui/feedback';

const onError = (err: unknown) => {
  if (err instanceof AppError && err.code === 'unauthenticated') authEvents.expired();
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: {
      retry: (count, err) => !(err instanceof AppError) && count < 2,
      refetchOnWindowFocus: true,
    },
  },
});

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.mustChangePassword) return <Navigate to="/change-password" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return (
      <div className="card">
        <EmptyState title="אין לך הרשאה לצפות במסך הזה">
          <ButtonLink to="/" variant="secondary" className="mt-3">
            חזרה לדף הבית
          </ButtonLink>
        </EmptyState>
      </div>
    );
  }
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="card">
      <EmptyState title="הדף לא נמצא">
        <ButtonLink to="/" variant="secondary" className="mt-3">
          חזרה לדף הבית
        </ButtonLink>
      </EmptyState>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackProvider>
        <DataProvider>
          <AuthProvider>
            <BrowserRouter basename={import.meta.env.BASE_URL}>
              <Suspense fallback={<Loading />}>
                <Routes>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/change-password" element={<ChangePasswordPage />} />
                  <Route
                    element={
                      <RequireAuth>
                        <AppShell />
                      </RequireAuth>
                    }
                  >
                    {MODULES.flatMap((m) =>
                      m.routes.map(({ path, component: Page, roles }) => (
                        <Route
                          key={path}
                          path={path}
                          element={
                            <RequireRole roles={roles}>
                              <Page />
                            </RequireRole>
                          }
                        />
                      )),
                    )}
                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </DataProvider>
      </FeedbackProvider>
    </QueryClientProvider>
  );
}
