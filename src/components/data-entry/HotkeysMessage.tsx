
'use client';

import React from 'react';

const HotkeysMessage: React.FC = () => {
  return (
    // Hidden on touch screens without a keyboard (iPad, phone), where hotkeys can't be used.
    <p className="text-sm text-muted-foreground touch:hidden">
      Hotkeys: 1-4 Focus slots | A/Alt+A Cycle Students | S/Alt+S Cycle Goals | C/N/B for counts | D/V/G/P/I for prompts | Ctrl+Enter Save. See Help.
    </p>
  );
};

export default HotkeysMessage;
