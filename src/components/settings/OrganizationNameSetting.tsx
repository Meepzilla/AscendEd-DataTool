'use client';

import React, { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { APP_NAME } from '@/lib/appConstants';
import { getOrganizationName, setOrganizationName } from '@/lib/organization';

/** Settings row for the school or district name shown at the top of printed reports. */
export default function OrganizationNameSetting() {
  const [name, setName] = useState('');

  useEffect(() => {
    setName(getOrganizationName());
  }, []);

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-4">
      <div className="space-y-0.5">
        <Label htmlFor="organization-name" className="text-base font-medium">School or District Name</Label>
        <p className="text-sm text-muted-foreground">
          Shown at the top of printed progress reports in place of &quot;{APP_NAME}&quot;. Leave blank to show {APP_NAME}.
          Saved on this device only.
        </p>
      </div>
      <Input
        id="organization-name"
        value={name}
        onChange={e => { setName(e.target.value); setOrganizationName(e.target.value); }}
        placeholder="e.g., Lane Education Service District"
        className="w-full sm:w-80"
        autoComplete="organization"
      />
    </div>
  );
}
