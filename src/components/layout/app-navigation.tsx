
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
  { href: '/student-profile', label: 'Students', icon: UserCog, hotkey: '1' },
  { href: '/goal-templates', label: 'Templates', icon: ListPlus, hotkey: '2' },
  { href: '/data-entry', label: 'Data Entry', icon: ClipboardList, hotkey: '3' },
  { href: '/manage-sessions', label: 'Sessions', icon: ListChecks, hotkey: '4' },
  { href: '/analysis-report', label: 'Reports', icon: BarChart2, hotkey: '5' },
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
  
  const navLinkClasses = (href: string, forDesktopHeader = false) => {
    const isActive = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
    if (forDesktopHeader) {
      return cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
        isActive && "bg-accent text-accent-foreground"
      );
    }
    return cn(
      baseItemClass,
      isActive && activeItemClass,
      isMobile ? "text-base" : "text-sm" // This line is for the vertical sidebar style
    );
  };

  if (!isMobile) {
    // Desktop header navigation
    return (
      <nav className="hidden md:flex items-center gap-1">
        {mainNavItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            legacyBehavior passHref
          >
            <Button
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
              <a>
                <item.icon className="h-4 w-4" />
                <span>{item.label}</span>
              </a>
            </Button>
          </Link>
        ))}
        {/* Secondary items could be in a dropdown if header space is tight, or listed if few */}
        {secondaryNavItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            legacyBehavior passHref
          >
            <Button
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
              <a>
                <item.icon className="h-4 w-4" />
                <span className="hidden lg:inline">{item.label}</span> {/* Show label on larger screens */}
              </a>
            </Button>
          </Link>
        ))}
      </nav>
    );
  }

  // Mobile navigation (vertical list in sheet)
  return (
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
  );
}
