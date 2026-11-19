
'use client';

import React, { createContext, useContext, useCallback, useEffect, useMemo, useRef, ReactNode } from 'react';
import confetti from 'canvas-confetti';

type ConfettiContextType = {
  fire: () => void;
};

const ConfettiContext = createContext<ConfettiContextType | null>(null);

// Outside a ConfettiProvider (e.g. editing a saved session, where goal inputs are reused) there is
// nothing to celebrate, so fire does nothing instead of crashing the page.
const NO_CONFETTI: ConfettiContextType = { fire: () => {} };

export const useConfetti = () => useContext(ConfettiContext) ?? NO_CONFETTI;

export const ConfettiProvider = ({ children }: { children: ReactNode }) => {
  const intervalsRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const intervals = intervalsRef.current;
    return () => {
      intervals.forEach(id => clearInterval(id));
      intervals.clear();
    };
  }, []);

  const fire = useCallback(() => {
    // Reduced motion: with the OS setting on, no celebration (globals.css covers the CSS side).
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const duration = 5 * 1000;
    const animationEnd = Date.now() + duration;

    const defaults = {
      startVelocity: 30,
      spread: 360,
      ticks: 60,
      zIndex: 0,
    };

    function randomInRange(min: number, max: number) {
      return Math.random() * (max - min) + min;
    }

    const interval = window.setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        intervalsRef.current.delete(interval);
        return clearInterval(interval);
      }

      const particleCount = 50 * (timeLeft / duration);

      // Launch from all four corners
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0, 0.2), y: Math.random() - 0.2 } })); // top-left
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.8, 1), y: Math.random() - 0.2 } })); // top-right
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0, 0.2), y: randomInRange(0.8, 1) } })); // bottom-left
      confetti(Object.assign({}, defaults, { particleCount, origin: { x: randomInRange(0.8, 1), y: randomInRange(0.8, 1) } })); // bottom-right

    }, 250);
    intervalsRef.current.add(interval);
  }, []);

  const value = useMemo(() => ({ fire }), [fire]);

  return (
    <ConfettiContext.Provider value={value}>
      {children}
    </ConfettiContext.Provider>
  );
};
