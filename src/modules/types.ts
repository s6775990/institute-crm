import type { LucideIcon } from 'lucide-react';
import type { ComponentType } from 'react';
import type { Role } from '../core/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  roles: Role[];
  /** Shown in the bottom bar on phones (up to 4 items); the rest go under "עוד". */
  mobile?: boolean;
  order: number;
}

export interface ModuleRoute {
  path: string;
  component: ComponentType;
  roles: Role[];
}

/**
 * A feature area of the system. New areas (finance, partnerships, dashboards...)
 * are added as another module in registry.ts without touching existing ones.
 */
export interface AppModule {
  id: string;
  nav: NavItem[];
  routes: ModuleRoute[];
}

export const ALL_ROLES: Role[] = ['admin', 'counselor'];
export const ADMIN_ONLY: Role[] = ['admin'];
