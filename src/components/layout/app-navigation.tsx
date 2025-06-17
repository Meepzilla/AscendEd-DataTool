
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserCog, ListPlus, ClipboardList, ListChecks, BarChart2, LayoutDashboard, HelpCircle, ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  hotkey?: string; 
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hotkey: 'D' },
  { href: '/student-profile', label: 'Student Profile', icon: UserCog, hotkey: '1' },
  { href: '/goal-templates', label: 'Goals Templates', icon: ListPlus, hotkey: '2' },
  { href: '/data-entry', label: 'Data Entry', icon: ClipboardList, hotkey: '3' },
  { href: '/manage-sessions', label: 'Manage Sessions', icon: ListChecks, hotkey: '4' },
  { href: '/analysis-report', label: 'Analysis Report', icon: BarChart2, hotkey: '5' },
];

const secondaryNavItems: NavItem[] = [
   { href: '/help', label: 'Help', icon: HelpCircle, hotkey: 'H' },
   { href: '/changelog', label: 'Changelog', icon: ScrollText, hotkey: '6' },
];

interface AppNavigationProps {
  isMobile?: boolean; 
}

export default function AppNavigation({ isMobile = false }: AppNavigationProps) {
  const pathname = usePathname();

  const baseItemClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary";
  const activeItemClass = "bg-primary/10 text-primary";
  
  const navLinkClasses = (href: string) => {
    const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    return cn(
      baseItemClass,
      isActive && activeItemClass,
      isMobile ? "text-base" : "text-sm"
    );
  };

  return (
    <nav className={cn("flex flex-col gap-1 p-2 sm:p-4", isMobile ? "h-full" : "w-full")}>
      {mainNavItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={navLinkClasses(item.href)}
          title={`${item.label} ${item.hotkey ? `(Alt+${item.hotkey})` : ''}`}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
          {item.hotkey && !isMobile && (
            <span className="ml-auto text-xs tracking-widest opacity-60">
              Alt+{item.hotkey}
            </span>
          )}
        </Link>
      ))}
      {(isMobile || secondaryNavItems.length > 0) && <Separator className="my-2" />}
      {secondaryNavItems.map((item) => (
         <Link
          key={item.label}
          href={item.href}
          className={navLinkClasses(item.href)}
          title={`${item.label} ${item.hotkey ? `(Alt+${item.hotkey})` : ''}`}
          aria-current={pathname === item.href ? "page" : undefined}
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
          {item.hotkey && !isMobile && (
            <span className="ml-auto text-xs tracking-widest opacity-60">
              Alt+{item.hotkey}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );
}
