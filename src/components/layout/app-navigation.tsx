
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserCog, ListPlus, ClipboardList, ListChecks, BarChart2, LayoutDashboard, HelpCircle, ScrollText, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  hotkey?: string;
}

const mainNavItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, hotkey: 'D' },
  { href: '/student-profile', label: 'Students', icon: UserCog, hotkey: '1' },
  { href: '/goal-templates', label: 'Templates', icon: ListPlus, hotkey: '2' },
  { href: '/data-entry', label: 'Data Entry', icon: ClipboardList, hotkey: '3' },
  { href: '/manage-sessions', label: 'Sessions', icon: ListChecks, hotkey: '4' },
  { href: '/analysis-report', label: 'Reports', icon: BarChart2, hotkey: '5' },
];

const secondaryNavItems: NavItem[] = [
   { href: '/settings', label: 'Settings', icon: Settings, hotkey: '7' },
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

  if (!isMobile) {
    // Desktop header navigation
    return (
      <nav className="hidden md:flex items-center gap-1">
        {mainNavItems.map((item) => (
          <Button
            key={item.label}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground hover:text-primary",
              (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && "text-primary bg-primary/10"
            )}
            title={`${item.label} ${item.hotkey ? `(Alt+${item.hotkey})` : ''}`}
            aria-current={(pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) ? "page" : undefined}
          >
            <Link href={item.href}>
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          </Button>
        ))}
        {secondaryNavItems.map((item) => (
          <Button
            key={item.label}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              "text-muted-foreground hover:text-primary",
              (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) && "text-primary bg-primary/10"
            )}
            title={`${item.label} ${item.hotkey ? `(Alt+${item.hotkey})` : ''}`}
            aria-current={(pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) ? "page" : undefined}
          >
            <Link href={item.href}>
              <item.icon className="h-4 w-4" />
              <span className="hidden lg:inline">{item.label}</span>
            </Link>
          </Button>
        ))}
      </nav>
    );
  }

  // Mobile navigation (vertical list in sheet)
  return (
    <ScrollArea className="h-full">
        <nav className={cn("flex flex-col gap-1 p-2 sm:p-4", isMobile ? "h-full" : "w-full")}>
            {mainNavItems.map((item) => (
                <Link
                key={item.label}
                href={item.href}
                className={navLinkClasses(item.href)}
                title={`${item.label} ${item.hotkey ? `(Alt+${item.hotkey})` : ''}`}
                aria-current={(pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) ? "page" : undefined}
                >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                </Link>
            ))}
            {(isMobile || secondaryNavItems.length > 0) && <Separator className="my-2" />}
            {secondaryNavItems.map((item) => (
                <Link
                key={item.label}
                href={item.href}
                className={navLinkClasses(item.href)}
                title={`${item.label} ${item.hotkey ? `(Alt+${item.hotkey})` : ''}`}
                aria-current={(pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))) ? "page" : undefined}
                >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
                </Link>
            ))}
        </nav>
    </ScrollArea>
  );
}
