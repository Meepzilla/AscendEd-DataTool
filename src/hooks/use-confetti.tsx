
'use client';

import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import confetti from 'canvas-confetti';

type ConfettiContextType = {
  fire: (origin: HTMLElement | null) => void;
};

const ConfettiContext = createContext<ConfettiContextType | null>(null);

export const useConfetti = () => {
  const context = useContext(ConfettiContext);
  if (!context) {
    throw new Error('useConfetti must be used within a ConfettiProvider');
  }
  return context;
};

export const ConfettiProvider = ({ children }: { children: ReactNode }) => {
  const fire = useCallback((originElement: HTMLElement | null) => {
    if (!originElement) return;

    const rect = originElement.getBoundingClientRect();
    const origin = {
      x: (rect.left + rect.width / 2) / window.innerWidth,
      y: (rect.top + rect.height / 2) / window.innerHeight,
    };

    confetti({
      origin: origin,
      particleCount: 100,
      spread: 70,
      angle: 90,
      startVelocity: 30,
      gravity: 1,
      scalar: 1.2,
      ticks: 200,
      colors: ['#3874F0', '#4DD0E1', '#FFFFFF']
    });
  }, []);

  return (
    <ConfettiContext.Provider value={{ fire }}>
      {children}
    </ConfettiContext.Provider>
  );
};
