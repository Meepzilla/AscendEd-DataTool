'use client';

import React from 'react';
import { APP_NAME } from '@/lib/constants';

export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  const hotkeys = [
    { key: 'Alt+H', desc: 'Help' },
    { key: 'Alt+L', desc: 'Error Log' },
    { key: 'Alt+M', desc: 'Add Student' },
    { key: 'Alt+B', desc: 'Toggle Sidebar' },
    { key: 'Alt+1-5', desc: 'Navigate Views' },
  ];

  return (
    <footer className="border-t bg-card text-card-foreground">
      <div className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} {APP_NAME}. All rights reserved.</p>
          <div className="mt-4 md:mt-0">
            <h3 className="font-semibold mb-1 text-foreground">Hotkey Reminders:</h3>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {hotkeys.map(hk => (
                <li key={hk.key}>
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">{hk.key}</kbd>: {hk.desc}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}
