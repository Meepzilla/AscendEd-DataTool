
'use client';

import React, { lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import Link from 'next/link';
import { UserPlus, ListPlus, ClipboardList, BarChart2, Users, Target, Activity, CheckSquare } from 'lucide-react';
import { APP_NAME } from '@/lib/appConstants';
import { formatDate } from '@/lib/helpers';
import { Skeleton } from '@/components/ui/skeleton';

const AppLoadingSkeleton = lazy(() => import('@/components/layout/AppLoadingSkeleton'));
export default function DashboardPage() {
  const { students, goalTemplates, sessions, loading, sessionsLoading, openAddStudentModal } = useStudentData();

  // Helper to safely get a timestamp from different date types
  const getSafeTimestamp = (date: Date | string): number => {
    if (date instanceof Date) {
      return date.getTime();
    }
    if (typeof date === 'string') {
      return new Date(date).getTime();
    }
    return 0; // Fallback for unexpected types
  };


  // Placeholder data for summary cards
  const summaryData = [
    { title: 'Total Students', value: loading ? '...' : students.length, icon: Users, href: '/student-profile', buttonLabel: 'Manage Students' },
    { title: 'Goal Templates', value: loading ? '...' : goalTemplates.length, icon: Target, href: '/goal-templates', buttonLabel: 'View Templates' },
    { title: 'Active Goals', value: loading ? '...' : students.reduce((acc, s) => acc + s.goals.filter(g => !g.isArchived).length, 0), icon: CheckSquare, href: '/data-entry', buttonLabel: 'Enter Data' },
    { title: 'Total Sessions', value: sessionsLoading ? '...' : sessions.length, icon: Activity, href: '/manage-sessions', buttonLabel: 'View Sessions' },
  ];

  const quickActions = [
    { label: 'Add New Student', icon: UserPlus, action: openAddStudentModal, href: null },
    { label: 'Create Goal Template', icon: ListPlus, href: '/goal-templates' }, // Link to page, modal can be triggered there
    { label: 'Start Data Entry', icon: ClipboardList, href: '/data-entry' },
    { label: 'View Reports', icon: BarChart2, href: '/analysis-report' },
  ];
  
  const recentActivities = React.useMemo(() => {
    if (loading || sessionsLoading) {
        return [];
    }

    const studentActivities = [...students]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 5)
        .map(student => ({
            id: `student-${student.id}`,
            type: 'student' as const,
            timestamp: new Date(student.createdAt),
            text: <>New student <strong>{student.name}</strong> added.</>
        }));
        
    const templateActivities = [...goalTemplates]
        .sort((a, b) => getSafeTimestamp(b.createdAt) - getSafeTimestamp(a.createdAt))
        .slice(0, 5)
        .map(template => ({
            id: `template-${template.id}`,
            type: 'template' as const,
            timestamp: new Date(template.createdAt),
            text: <>{template.isDefault ? 'New default template' : 'New template'} "<strong>{template.name}</strong>" created.</>
        }));

    const sessionActivities = [...sessions]
        // sessions are already sorted by date descending from the hook
        .slice(0, 5)
        .map(session => ({
            id: `session-${session.sessionId}`,
            type: 'session' as const,
            timestamp: new Date(session.date),
            text: <>Session data entered for <strong>{session.studentName}</strong>.</>
        }));
    
    return [...studentActivities, ...templateActivities, ...sessionActivities]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 5); // Take the 5 most recent activities overall

  }, [students, goalTemplates, sessions, loading, sessionsLoading]);


  if (loading) {
    return (
      <Suspense fallback={<div>Loading skeleton...</div>}><AppLoadingSkeleton /></Suspense>
    );
  }

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome to {APP_NAME}</h1>
        <p className="text-muted-foreground">Your central hub for student goal management and progress tracking.</p>
      </div>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {quickActions.map((action) => {
            const cardContent = (
              <CardContent className="p-4 flex flex-col items-center justify-center text-center h-full">
                <action.icon className="h-8 w-8 text-primary mb-2" />
                <h3 className="text-sm font-semibold">{action.label}</h3>
              </CardContent>
            );

            if (action.href) {
              return (
                <Link key={action.label} href={action.href} passHref>
                  <Card className="h-full hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary">
                    {cardContent}
                  </Card>
                </Link>
              );
            } else {
              return (
                 <button key={action.label} onClick={action.action} className="w-full h-full text-left">
                    <Card className="h-full hover:bg-muted/50 transition-colors focus-visible:ring-2 focus-visible:ring-primary">
                        {cardContent}
                    </Card>
                 </button>
              );
            }
          })}
        </div>
      </section>

      {/* Summary Cards */}
      <section aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-xl font-semibold mb-4 text-foreground">Overview</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {summaryData.map((item) => (
            <Link key={item.title} href={item.href} passHref>
              <Card className="shadow-lg hover:shadow-xl transition-shadow h-full hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                  <item.icon className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{item.value}</div>
                  <p className="text-xs text-muted-foreground pt-1">
                    {item.buttonLabel} &rarr;
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Activity */}
      <section aria-labelledby="recent-activity-title">
        <h2 id="recent-activity-title" className="text-xl font-semibold mb-4 text-foreground">Recent Activity</h2>
        <Card>
          <CardContent className="p-6">
            {loading || sessionsLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3"><Skeleton className="h-5 w-5 rounded-full" /><Skeleton className="h-4 w-4/5" /></div>
                ))}
              </div>
            ) : recentActivities.length === 0 ? (
              <p className="text-muted-foreground">No recent activity to display. Add a student or record a session to get started.</p>
            ) : (
              <ul className="space-y-3">
                {recentActivities.map(activity => (
                  <li key={activity.id} className="flex items-center gap-3 text-sm">
                    {activity.type === 'session' && <ClipboardList className="h-4 w-4 text-primary"/>}
                    {activity.type === 'student' && <UserPlus className="h-4 w-4 text-primary"/>}
                    {activity.type === 'template' && <ListPlus className="h-4 w-4 text-primary"/>}
                    <span className="text-muted-foreground">{activity.text}</span>
                    <span className="ml-auto text-xs text-muted-foreground/80 whitespace-nowrap">{formatDate(activity.timestamp)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
