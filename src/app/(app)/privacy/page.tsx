import React from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { APP_NAME } from '@/lib/appConstants';

// The privacy notice: what the app stores, where, who can see it, and how to delete it. Written for staff and for
// district reviewers (FERPA, Oregon's Student Information Protection Act). Keep it in step with what the app does.

export const metadata = { title: `Privacy Notice | ${APP_NAME}` };

const LAST_UPDATED = 'October 31, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <h2 className="text-xl font-semibold">{title}</h2>
      </CardHeader>
      <CardContent className="space-y-3 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-10 w-10 shrink-0 text-primary" aria-hidden />
            <div>
              <h1 className="text-3xl font-bold">Privacy Notice</h1>
              <p className="text-sm text-muted-foreground">Last updated {LAST_UPDATED}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm leading-relaxed">
          <p>
            <strong>In short:</strong> {APP_NAME} keeps student information only on the device where you enter it. Nothing
            is sent to a server, the developer, or anyone else. There are no accounts, analytics, advertising or tracking.
          </p>
        </CardContent>
      </Card>

      <Section title="What is stored">
        <p>Only what you type or record in the app:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Student names (a first name or initials is enough).</li>
          <li>Each student&apos;s goals: the goal text, type and session target.</li>
          <li>Session data: dates and times, trial and count results, prompt levels, ratings, behavior (ABC) records, activity descriptions and notes.</li>
          <li>Goal templates, and app settings such as display size and menu bar position.</li>
          <li>Unsaved Data Entry work, so it isn&apos;t lost if the app closes.</li>
        </ul>
        <p>
          The app does not collect student ID numbers, dates of birth, addresses, photos, parent contacts, grades, device
          identifiers, location or usage data. Please don&apos;t enter medical diagnoses or other information the goals
          don&apos;t need.
        </p>
      </Section>

      <Section title="Where it is stored">
        <p>
          In this browser&apos;s storage on this device only (for example, the iPad&apos;s Home Screen app or Safari). It
          isn&apos;t synced to other devices or backed up to the cloud by the app. The app works without an internet
          connection.
        </p>
        <p>
          The app itself (its code, not your data) is downloaded from Cloudflare&apos;s hosting. The browser only allows
          the app&apos;s own scripts to run, and the app has no third-party code.
        </p>
      </Section>

      <Section title="Who can see it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Anyone who can open the app on this device. Turn on <strong>Passcode Protection</strong> (Settings) to require a passcode: the student data is then encrypted (AES-256) and the app locks after a period without use.</li>
          <li>Nobody else. The developer, the hosting company and the district can&apos;t see it unless you share a file.</li>
          <li>Files you create leave the device only where you put them: <strong>backups</strong> (which can be protected with a password) and <strong>CSV exports</strong> (not encrypted). Store them only in district-approved places.</li>
        </ul>
      </Section>

      <Section title="How it is used">
        <p>
          Only to record and report students&apos; progress on their goals. It is never sold, shared, used for advertising,
          or used to build profiles. This meets the requirements of FERPA and Oregon&apos;s Student Information Protection
          Act (ORS 336.184).
        </p>
      </Section>

      <Section title="How to delete it">
        <ul className="list-disc space-y-1 pl-5">
          <li><strong>One student or session:</strong> delete it on the Students or Sessions page.</li>
          <li><strong>Students who have left:</strong> Settings → Delete Data → End-of-year clean-up.</li>
          <li><strong>Everything on this device:</strong> Settings → Delete Data → Delete All Data. Removing the app from the Home Screen or clearing Safari&apos;s website data also removes it.</li>
        </ul>
        <p>Deleted data can only be recovered from a backup you saved.</p>
      </Section>

      <Section title="If a device is lost">
        <p>
          Follow your district&apos;s procedure for a lost device. With Passcode Protection on, the student data on it
          stays encrypted and can&apos;t be read without the passcode.
        </p>
      </Section>

      <Section title="Questions">
        <p>
          Contact your district&apos;s technology or data privacy office, or the staff member who provided {APP_NAME}.
          See also <Link href="/help" className="underline hover:text-primary">Help</Link> and{' '}
          <Link href="/settings" className="underline hover:text-primary">Settings</Link>.
        </p>
      </Section>
    </div>
  );
}
