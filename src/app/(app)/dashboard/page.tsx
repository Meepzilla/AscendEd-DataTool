
'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useStudentData } from '@/hooks/use-student-data';
import Link from 'next/link';
import { UserPlus, ListPlus, ClipboardList, BarChart2, Users, Target, Activity, CheckSquare } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export default function DashboardPage() {
  const { students, goalTemplates, sessions, loading, sessionsLoading, openAddStudentModal } = useStudentData();

  // Placeholder data for summary cards
  const summaryData = [
    { title: 'Total Students', value: loading ? '...' : students.length, icon: Users, href: '/student-profile', buttonLabel: 'Manage Students' },
    { title: 'Goal Templates', value: loading ? '...' : goalTemplates.length, icon: Target, href: '/goal-templates', buttonLabel: 'View Templates' },
    { title: 'Active Goals', value: loading ? '...' : students.reduce((acc, s) => acc + s.goals.length, 0), icon: CheckSquare, href: '/data-entry', buttonLabel: 'Enter Data' },
    { title: 'Total Sessions', value: sessionsLoading ? '...' : sessions.length, icon: Activity, href: '/manage-sessions', buttonLabel: 'View Sessions' },
  ];

  const quickActions = [
    { label: 'Add New Student', icon: UserPlus, action: openAddStudentModal, href: null },
    { label: 'Create Goal Template', icon: ListPlus, href: '/goal-templates' }, // Link to page, modal can be triggered there
    { label: 'Start Data Entry', icon: ClipboardList, href: '/data-entry' },
    { label: 'View Reports', icon: BarChart2, href: '/analysis-report' },
  ];

  return (
    <div className="space-y-8">
      <div className="pb-6 border-b">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome to {APP_NAME}</h1>
        <p className="text-muted-foreground">Your central hub for student goal management and progress tracking.</p>
      </div>

      {/* Summary Cards */}
      <section aria-labelledby="summary-title">
        <h2 id="summary-title" className="text-xl font-semibold mb-4 text-foreground">Overview</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {summaryData.map((item) => (
            <Card key={item.title} className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
                <item.icon className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{item.value}</div>
                <p className="text-xs text-muted-foreground pt-1">
                  <Link href={item.href} passHref>
                    <Button variant="link" className="p-0 h-auto text-xs">{item.buttonLabel}</Button>
                  </Link>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Quick Actions */}
      <section aria-labelledby="quick-actions-title">
        <h2 id="quick-actions-title" className="text-xl font-semibold mb-4 text-foreground">Quick Actions</h2>
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {quickActions.map((action) => (
            <Card key={action.label} className="hover:bg-muted/50 transition-colors">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <action.icon className="h-10 w-10 text-primary mb-3" />
                <h3 className="text-md font-semibold mb-2">{action.label}</h3>
                {action.href ? (
                  <Link href={action.href} passHref>
                    <Button variant="outline" size="sm">Go</Button>
                  </Link>
                ) : (
                  <Button variant="outline" size="sm" onClick={action.action}>Start</Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Placeholder for Recent Activity or Important Notifications */}
      <section aria-labelledby="recent-activity-title">
        <h2 id="recent-activity-title" className="text-xl font-semibold mb-4 text-foreground">Recent Activity</h2>
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">Recent activity feed or important notifications will be displayed here.</p>
            {/* Example: List of recent sessions, newly added students, etc. */}
            <ul className="mt-4 space-y-2">
              <li className="flex items-center gap-2 text-sm">
                <ClipboardList className="h-4 w-4 text-primary"/> Session data entered for <strong>Student A</strong>.
              </li>
              <li className="flex items-center gap-2 text-sm">
                <UserPlus className="h-4 w-4 text-primary"/> New student <strong>Student B</strong> added.
              </li>
               <li className="flex items-center gap-2 text-sm">
                <ListPlus className="h-4 w-4 text-primary"/> New goal template "Reading Fluency" created.
              </li>
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
