'use client';

import React, { useEffect, useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// A dashboard card that can be collapsed to its title (with its count, so it still says how many need
// attention). Whether each card is collapsed is remembered on this device.

const STORAGE_KEY = 'ascended_dashboard_collapsed';

function readCollapsed(id: string): boolean {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')[id] === true;
  } catch {
    return false;
  }
}

function writeCollapsed(id: string, collapsed: boolean) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    all[id] = collapsed;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Storage unavailable: the card just isn't remembered as collapsed.
  }
}

interface Props {
  /** Remembers this card's state (e.g. "due-soon"). */
  id: string;
  title: string;
  icon: React.ReactNode;
  description: React.ReactNode;
  /** How many items the card lists, shown next to the title; nothing when there are none. */
  count?: number;
  countLabel?: string;
  children: React.ReactNode;
}

export default function CollapsibleCard({ id, title, icon, description, count, countLabel, children }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const contentId = useId();
  // Read after the first render, so the page made at build time matches (it has no stored state).
  useEffect(() => setCollapsed(readCollapsed(id)), [id]);
  const toggle = () => setCollapsed(prev => { writeCollapsed(id, !prev); return !prev; });

  return (
    <Card>
      <CardHeader className={cn(collapsed ? 'pb-6' : 'pb-3')}>
        <CardTitle className="text-lg">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-controls={contentId}
            className="-m-1 flex w-[calc(100%+0.5rem)] items-center gap-2 rounded-sm p-1 text-left hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {icon}
            <span>{title}</span>
            {!!count && <Badge variant="secondary" aria-label={countLabel}>{count}</Badge>}
            <ChevronDown className={cn('ml-auto h-5 w-5 shrink-0 text-muted-foreground transition-transform', collapsed && '-rotate-90')} aria-hidden />
          </button>
        </CardTitle>
        {!collapsed && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent id={contentId} hidden={collapsed}>
        {children}
      </CardContent>
    </Card>
  );
}
