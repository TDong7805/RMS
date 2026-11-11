import {
  Bell,
  Bot,
  CalendarCheck,
  LayoutDashboard,
  LayoutGrid,
  Newspaper,
  ScrollText,
  Settings,
  UserCog,
  Users,
  Utensils,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

export const iconMap: Record<string, ComponentType<LucideProps>> = {
  'layout-dashboard': LayoutDashboard,
  'calendar-check': CalendarCheck,
  'layout-grid': LayoutGrid,
  utensils: Utensils,
  users: Users,
  newspaper: Newspaper,
  'user-cog': UserCog,
  bot: Bot,
  bell: Bell,
  'scroll-text': ScrollText,
  settings: Settings,
};

export function getMenuIcon(name: string): ComponentType<LucideProps> {
  return iconMap[name] ?? LayoutDashboard;
}