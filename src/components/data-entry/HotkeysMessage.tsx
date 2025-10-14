'use client';

import React from 'react';

const HotkeysMessage: React.FC = () => {
  return (
    <p className="text-sm text-muted-foreground">
      Hotkeys: 1-4 Focus initial slots | A/Alt+A Cycle Students | S/Alt+S Cycle Goals | C/N/B for counts | D/V/G/P/F/I for prompts | Ctrl+Enter Save. See Help.
    </p>
  );
};

export default HotkeysMessage;
