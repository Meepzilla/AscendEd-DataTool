// The teacher's PIN for turning off the Student Access Lock on Data Entry. Only a hash is kept, on this device.

const PIN_KEY = 'ascended_access_pin_v1_';

export const PIN_PATTERN = /^\d{4,8}$/;

async function hashPin(uid: string, pin: string): Promise<string> {
  const text = `ascended-access-lock:${uid}:${pin}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  }
  // No Web Crypto (an insecure origin): a plain string hash is still better than storing the PIN.
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `djb2:${hash.toString(16)}`;
}

export function hasAccessPin(uid: string | undefined): boolean {
  try {
    return !!localStorage.getItem(PIN_KEY + (uid || 'guest'));
  } catch {
    return false;
  }
}

export async function setAccessPin(uid: string | undefined, pin: string): Promise<boolean> {
  try {
    localStorage.setItem(PIN_KEY + (uid || 'guest'), await hashPin(uid || 'guest', pin));
    return true;
  } catch {
    return false;
  }
}

export async function checkAccessPin(uid: string | undefined, pin: string): Promise<boolean> {
  try {
    const stored = localStorage.getItem(PIN_KEY + (uid || 'guest'));
    return !!stored && stored === (await hashPin(uid || 'guest', pin));
  } catch {
    return false;
  }
}

export function clearAccessPin(uid: string | undefined) {
  try {
    localStorage.removeItem(PIN_KEY + (uid || 'guest'));
  } catch {
    // Nothing stored.
  }
}
