'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserCog, ListPlus, ClipboardList, ListChecks, BarChart2, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  hotkey?: string; // e.g., "1" for Alt+1
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hotkey: 'D' },
  { href: '/student-profile', label: 'Student Profile', icon: UserCog, hotkey: '1' },
  { href: '/goal-templates', label: 'Goals Templates', icon: ListPlus, hotkey: '2' },
  { href: '/data-entry', label: 'Data Entry', icon: ClipboardList, hotkey: '3' },
  { href: '/manage-sessions', label: 'Manage Sessions', icon: ListChecks, hotkey: '4' },
  { href: '/analysis-report', label: 'Analysis Report', icon: BarChart2, hotkey: '5' },
];

interface AppNavigationProps {
  isMobile?: boolean; // For adapting styles in mobile drawer
}

export default function AppNavigation({ isMobile = false }: AppNavigationProps) {
  const pathname = usePathname();

  const baseItemClass = "flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary";
  const activeItemClass = "bg-primary/10 text-primary";
  
  const navLinkClasses = (href: string) => {
    // More robust active check for nested routes
    const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    return cn(
      baseItemClass,
      isActive && activeItemClass,
      isMobile ? "text-base" : "text-sm"
    );
  };

  return (
    <nav className={cn("flex flex-col gap-1 p-2 sm:p-4", isMobile ? "h-full" : "w-full")}>
      {navItems.map((item) => (
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
       {isMobile && <Separator className="my-4" />}
       {/* Add settings or other links for mobile drawer if needed */}
    </nav>
  );
}
