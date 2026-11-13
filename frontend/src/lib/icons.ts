import {
  Bell,
  Bot,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  LayoutGrid,
  Newspaper,
  Package,
  PackageMinus,
  PackagePlus,
  ScrollText,
  Settings,
  Truck,
  UserCog,
  Users,
  Utensils,
  Wallet,
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
  package: Package,
  truck: Truck,
  'clipboard-list': ClipboardList,
  'package-plus': PackagePlus,
  'package-minus': PackageMinus,
  'clipboard-check': ClipboardCheck,
  wallet: Wallet,
};

export function getMenuIcon(name: string): ComponentType<LucideProps> {
  return iconMap[name] ?? LayoutDashboard;
}