import { Bell, LogOut, Menu, TriangleAlert } from 'lucide-react';
import { Suspense, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth, useCurrentUser } from '../auth/AuthContext';
import { ROLE_LABELS } from '../core/labels';
import { useDemo } from '../data/DataContext';
import { useNotifications } from '../data/queries';
import { navItemsFor } from '../modules/registry';
import { Loading } from '../ui/common';
import { Dialog } from '../ui/Dialog';

function NotificationBell() {
  const { data } = useNotifications();
  const unread = (data ?? []).filter((n) => !n.readAt).length;
  return (
    <Link
      to="/notifications"
      className="relative rounded-full p-2.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      aria-label={unread ? `התראות – ${unread} חדשות` : 'התראות'}
      title="התראות"
    >
      <Bell className="h-6 w-6" aria-hidden />
      {unread > 0 && (
        <span className="absolute -end-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-bold text-white">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  );
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition ${
    isActive ? 'bg-brand-700 text-white' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
  }`;

export function AppShell() {
  const user = useCurrentUser();
  const { signOut } = useAuth();
  const demo = useDemo();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const items = navItemsFor(user.role);
  const mobileItems = items.filter((i) => i.mobile).slice(0, 4);

  return (
    <div className="min-h-screen lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        דילוג לתוכן
      </a>

      {/* Desktop side menu */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-e border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-9 w-9" />
          <span className="text-xl font-bold text-slate-900">ניהול המוקד</span>
        </div>
        <nav aria-label="תפריט ראשי" className="flex-1 space-y-1 overflow-y-auto px-3">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass}>
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="font-semibold text-slate-900">{user.fullName}</p>
          <p className="text-sm text-slate-500">{ROLE_LABELS[user.role]}</p>
          <button type="button" onClick={signOut} className="mt-3 flex items-center gap-2 font-medium text-slate-600 hover:text-red-700">
            <LogOut className="h-5 w-5" aria-hidden />
            יציאה מהמערכת
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {demo && (
          <div className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm font-medium text-amber-900">
            <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
            מצב הדגמה: המידע נשמר רק בדפדפן הזה. אין להזין פרטים אמיתיים של תורמים.
          </div>
        )}

        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-2 backdrop-blur lg:justify-end">
          <Link to="/" className="flex items-center gap-2 lg:hidden">
            <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" className="h-8 w-8" />
            <span className="text-lg font-bold">ניהול המוקד</span>
          </Link>
          <div className="flex items-center gap-1">
            <span className="me-2 hidden text-slate-600 lg:inline">שלום, {user.fullName}</span>
            <NotificationBell />
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 lg:px-8 lg:pb-10">
          <Suspense fallback={<Loading />}>
            <Outlet key={location.pathname} />
          </Suspense>
        </main>
      </div>

      {/* Phone/tablet bottom bar */}
      <nav aria-label="תפריט ראשי" className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
        <ul className="flex">
          {mobileItems.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2 text-sm font-medium ${isActive ? 'text-brand-700' : 'text-slate-600'}`
                }
              >
                <item.icon className="h-6 w-6" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
          <li className="flex-1">
            <button type="button" onClick={() => setMenuOpen(true)} className="flex w-full flex-col items-center gap-0.5 py-2 text-sm font-medium text-slate-600">
              <Menu className="h-6 w-6" aria-hidden />
              עוד
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={menuOpen} onClose={() => setMenuOpen(false)} title="תפריט">
        <p className="-mt-1 text-slate-600">
          {user.fullName} · {ROLE_LABELS[user.role]}
        </p>
        <nav aria-label="כל המסכים" className="space-y-1">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={navLinkClass} onClick={() => setMenuOpen(false)}>
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            setMenuOpen(false);
            signOut();
          }}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-red-700 hover:bg-red-50"
        >
          <LogOut className="h-5 w-5" aria-hidden />
          יציאה מהמערכת
        </button>
      </Dialog>
    </div>
  );
}
