
'use client';

import React from 'react';
import { APP_NAME } from '@/lib/appConstants';

export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  // This list should be kept in sync with useKeyboardShortcuts.ts and help page.
  const hotkeys = [
    { key: 'Alt+D', desc: 'Dashboard' },
    { key: 'Alt+1-5', desc: 'Navigate Views' },
    { key: 'Alt+6', desc: 'Changelog' },
    { key: 'Alt+H', desc: 'Help Page' },
    { key: 'Alt+J', desc: 'Error Log (Icon)' },
    { key: 'Alt+M', desc: 'Add Student' },
    { key: 'Alt+K', desc: 'Toggle Sidebar' },
    { key: 'Alt+Q', desc: 'Remove Slot'},
  ];

  return (
    <footer className="border-t bg-card text-card-foreground">
      {/* Bottom padding keeps the footer's links clear of the host's corner badge. */}
      <div className="container mx-auto px-4 pt-6 pb-[calc(1.5rem+var(--host-badge-clearance))] sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} {APP_NAME}. All rights reserved.</p>
          <div className="mt-4 md:mt-0">
            <h3 className="font-semibold mb-1 text-foreground">Global Hotkeys:</h3>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {hotkeys.map(hk => (
                <li key={hk.key}>
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">{hk.key}</kbd>: {hk.desc}
                </li>
              ))}
            </ul>
             <p className="text-xs mt-1">See <a href="/help" className="underline hover:text-primary">Help Page</a> for Data Entry hotkeys.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
