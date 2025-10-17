'use client';

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface FakeDataToggleProps {
  isFakeDataMode: boolean;
  setIsFakeDataMode: (isFake: boolean) => void;
}

const FakeDataToggle: React.FC<FakeDataToggleProps> = ({ isFakeDataMode, setIsFakeDataMode }) => {
  return (
    <div className="flex items-center space-x-2 border p-2 rounded-md bg-yellow-50 dark:bg-yellow-900/20">
      <Switch
        id="fake-data-mode"
        checked={isFakeDataMode}
        onCheckedChange={setIsFakeDataMode}
        aria-label="Toggle Fake Data Mode"
      />
      <Label htmlFor="fake-data-mode" className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
        Dev: Fake Data Mode
      </Label>
    </div>
  );
};

export default FakeDataToggle;
