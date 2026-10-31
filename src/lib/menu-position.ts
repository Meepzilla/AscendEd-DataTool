// Where the app's menu bar sits: at the top of the screen (default) or at the bottom. Saved on this device.
// The choice is a class on <html> ("menu-bottom"), set before the first paint by the display-size script
// (display-scale.ts) and read by the CSS in globals.css.

export type MenuPosition = 'top' | 'bottom';
export const MENU_POSITION_KEY = 'ascended_menu_position';
export const MENU_POSITION_EVENT = 'ascended-menu-position';

export function getMenuPosition(): MenuPosition {
  try {
    return localStorage.getItem(MENU_POSITION_KEY) === 'bottom' ? 'bottom' : 'top';
  } catch {
    return 'top';
  }
}

export function setMenuPosition(position: MenuPosition) {
  try {
    localStorage.setItem(MENU_POSITION_KEY, position);
  } catch {
    // Not saved; still applied for this visit.
  }
  document.documentElement.classList.toggle('menu-bottom', position === 'bottom');
  window.dispatchEvent(new Event(MENU_POSITION_EVENT));
}
