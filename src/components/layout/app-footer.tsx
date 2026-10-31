
'use client';

import React, { useEffect, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { APP_NAME } from '@/lib/appConstants';

const HOTKEYS_COLLAPSED_KEY = 'ascended_footer_hotkeys_collapsed';

export default function AppFooter() {
  const currentYear = new Date().getFullYear();

  // This list should be kept in sync with useKeyboardShortcuts.ts and help page.
  const hotkeys = [
    { key: 'Alt+D', desc: 'Dashboard' },
    { key: 'Alt+1-5', desc: 'Navigate Views' },
    { key: 'Alt+6', desc: 'Changelog' },
    { key: 'Alt+7', desc: 'Settings' },
    { key: 'Alt+H', desc: 'Help Page' },
    { key: 'Alt+J', desc: 'Error Log (Icon)' },
    { key: 'Alt+M', desc: 'Add Student' },
    { key: 'Alt+K', desc: 'Toggle Sidebar' },
    { key: 'Alt+Q', desc: 'Remove Slot'},
  ];

  // The hotkey list can be hidden; the choice is remembered on this device.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try { setCollapsed(localStorage.getItem(HOTKEYS_COLLAPSED_KEY) === '1'); } catch { /* shown */ }
  }, []);
  const toggle = () => setCollapsed(prev => {
    try { localStorage.setItem(HOTKEYS_COLLAPSED_KEY, prev ? '0' : '1'); } catch { /* this visit only */ }
    return !prev;
  });

  return (
    <footer className="border-t bg-card text-card-foreground">
      {/* Kept short: the footer scrolls with the page, so it only needs room for the iPhone/iPad home indicator. */}
      <div className="container mx-auto px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom)/var(--body-zoom))] sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-muted-foreground">
          <p>&copy; {currentYear} {APP_NAME}. All rights reserved.</p>
          <div className="mt-2 text-center md:mt-0 md:text-left">
            <h3 className="mb-0.5 flex justify-center md:justify-start">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={!collapsed}
                aria-controls="footer-hotkeys"
                className="flex items-center gap-1 rounded-sm font-semibold text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Global Hotkeys
                <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? '-rotate-90' : ''}`} aria-hidden />
                <span className="sr-only">{collapsed ? '(show)' : '(hide)'}</span>
              </button>
            </h3>
            <ul id="footer-hotkeys" className={`${collapsed ? 'hidden' : 'flex'} flex-wrap justify-center gap-x-4 gap-y-1 md:justify-start`}>
              {hotkeys.map(hk => (
                <li key={hk.key}>
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">{hk.key}</kbd>: {hk.desc}
                </li>
              ))}
            </ul>
            <p className="text-xs mt-0.5">See <Link href="/help" className="underline hover:text-primary">Help Page</Link> for Data Entry hotkeys. <Link href="/privacy" className="underline hover:text-primary">Privacy Notice</Link></p>
          </div>
        </div>
      </div>
    </footer>
  );
}
