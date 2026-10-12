// All feature modules of the system. To add a module (e.g. finance), create a
// folder under src/modules with its pages and add an entry here — navigation,
// routing and role checks pick it up automatically.

import { Bell, Home, Inbox, ListTodo, Settings, UserCircle, Users, UsersRound } from 'lucide-react';
import { lazy } from 'react';
import type { Role } from '../core/types';
import { ADMIN_ONLY, ALL_ROLES, type AppModule, type NavItem } from './types';

export const MODULES: AppModule[] = [
  {
    id: 'home',
    nav: [{ to: '/', label: 'דף הבית', icon: Home, roles: ALL_ROLES, mobile: true, order: 0 }],
    routes: [{ path: '/', component: lazy(() => import('./home/HomePage')), roles: ALL_ROLES }],
  },
  {
    id: 'leads',
    nav: [{ to: '/leads', label: 'לידים', icon: Inbox, roles: ADMIN_ONLY, mobile: true, order: 10 }],
    routes: [
      { path: '/leads', component: lazy(() => import('./leads/LeadsPage')), roles: ADMIN_ONLY },
      { path: '/leads/:id', component: lazy(() => import('./leads/LeadPage')), roles: ADMIN_ONLY },
    ],
  },
  {
    id: 'clients',
    nav: [{ to: '/clients', label: 'תורמים', icon: Users, roles: ALL_ROLES, mobile: true, order: 20 }],
    routes: [
      { path: '/clients', component: lazy(() => import('./clients/ClientsPage')), roles: ALL_ROLES },
      { path: '/clients/:id', component: lazy(() => import('./clients/ClientPage')), roles: ALL_ROLES },
    ],
  },
  {
    id: 'tasks',
    nav: [{ to: '/tasks', label: 'משימות', icon: ListTodo, roles: ALL_ROLES, mobile: true, order: 30 }],
    routes: [{ path: '/tasks', component: lazy(() => import('./tasks/TasksPage')), roles: ALL_ROLES }],
  },
  {
    id: 'notifications',
    nav: [{ to: '/notifications', label: 'התראות', icon: Bell, roles: ALL_ROLES, order: 40 }],
    routes: [{ path: '/notifications', component: lazy(() => import('./notifications/NotificationsPage')), roles: ALL_ROLES }],
  },
  {
    id: 'team',
    nav: [{ to: '/team', label: 'צוות והרשאות', icon: UsersRound, roles: ADMIN_ONLY, order: 80 }],
    routes: [{ path: '/team', component: lazy(() => import('./team/TeamPage')), roles: ADMIN_ONLY }],
  },
  {
    id: 'settings',
    nav: [{ to: '/settings', label: 'הגדרות', icon: Settings, roles: ADMIN_ONLY, order: 90 }],
    routes: [{ path: '/settings', component: lazy(() => import('./settings/SettingsPage')), roles: ADMIN_ONLY }],
  },
  {
    id: 'account',
    nav: [{ to: '/account', label: 'החשבון שלי', icon: UserCircle, roles: ALL_ROLES, order: 100 }],
    routes: [{ path: '/account', component: lazy(() => import('./account/AccountPage')), roles: ALL_ROLES }],
  },
];

export function navItemsFor(role: Role): NavItem[] {
  return MODULES.flatMap((m) => m.nav)
    .filter((n) => n.roles.includes(role))
    .sort((a, b) => a.order - b.order);
}
