import type { Goal } from './types';

// Item mastery goals: a list of targets (vocabulary, sight words, core words, signs, sounds) set on the student's
// goal (Edit Goal → Items). In a session each item tried is marked correct or incorrect; the session measure is the
// percentage of the items tried that were correct. Across sessions, an item is mastered once it has been correct
// the last ITEM_MASTERY_RUN times it was tried in a row. Each session keeps the items' names, so changing the list
// later doesn't change past data.

export type ItemResult = 'correct' | 'incorrect' | '';
export interface ItemScore { label: string; result: ItemResult }

/** An item is mastered when it was correct this many sessions in a row (sessions where it was tried). */
export const ITEM_MASTERY_RUN = 3;
/** The most items one goal's list can hold. */
export const MAX_LIST_ITEMS = 100;

/** The goal's items (Edit Goal), trimmed, without blanks or repeats. */
export function listItems(goal: Pick<Goal, 'listItems'> | null | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of Array.isArray(goal?.listItems) ? goal!.listItems : []) {
    const item = String(raw).trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= MAX_LIST_ITEMS) break;
  }
  return out;
}

/** A session's item scores, as saved; a session with none saved is lined up with the goal's current items. */
export function itemScores(data: Record<string, any> = {}, items: string[]): ItemScore[] {
  const saved: ItemScore[] = Array.isArray(data.items) ? data.items : [];
  if (saved.length > 0) {
    return saved
      .filter(s => s && typeof s.label === 'string')
      .map(s => ({ label: s.label, result: s.result === 'correct' || s.result === 'incorrect' ? s.result : '' }));
  }
  return items.map(label => ({ label, result: '' as const }));
}

/** Items tried and correct in one session. */
export function itemMasterySummary(data: Record<string, any> = {}) {
  const scores = itemScores(data, []);
  const tried = scores.filter(s => s.result);
  const correct = tried.filter(s => s.result === 'correct').length;
  return { tried: tried.length, correct, percent: tried.length ? (correct / tried.length) * 100 : null };
}

/** Sets one item's result (the same result again clears it). */
export function setItemResult(data: Record<string, any>, items: string[], index: number, result: Exclude<ItemResult, ''>): Record<string, any> {
  const scores = itemScores(data, items);
  if (!scores[index]) return data;
  scores[index] = { ...scores[index], result: scores[index].result === result ? '' : result };
  return { ...data, items: scores };
}

/** Marks the next unmarked item (Data Entry hotkeys); null when every item is marked or there are none. */
export function scoreNextItem(data: Record<string, any>, items: string[], result: Exclude<ItemResult, ''>): Record<string, any> | null {
  const scores = itemScores(data, items);
  const next = scores.findIndex(s => !s.result);
  if (next === -1) return null;
  scores[next] = { ...scores[next], result };
  return { ...data, items: scores };
}

export interface ItemHistory {
  label: string;
  /** Results in session order, oldest first: true correct, false incorrect, null not tried. */
  results: (boolean | null)[];
  tries: number;
  correct: number;
  mastered: boolean;
  /** The index of the session where the item became mastered (and stayed so), or null. */
  masteredAt: number | null;
}

const keyOf = (label: string) => label.trim().toLowerCase();

/**
 * Each item's results across sessions (oldest first), and whether it is mastered: correct in the last
 * ITEM_MASTERY_RUN sessions it was tried. Items are matched by name, case-insensitively; the goal's current items
 * come first, then any items only in past sessions.
 */
export function itemHistory(sessionsData: Record<string, any>[], currentItems: string[] = []): ItemHistory[] {
  const order: string[] = [];
  const labels = new Map<string, string>();
  const add = (label: string) => {
    const key = keyOf(label);
    if (!key || labels.has(key)) return;
    labels.set(key, label.trim());
    order.push(key);
  };
  currentItems.forEach(add);
  const perSession = sessionsData.map(d => {
    const map = new Map<string, boolean>();
    for (const s of itemScores(d, [])) {
      if (!s.result) continue;
      add(s.label);
      map.set(keyOf(s.label), s.result === 'correct');
    }
    return map;
  });
  return order.map(key => {
    const results = perSession.map(m => (m.has(key) ? m.get(key)! : null));
    let run = 0;
    let masteredAt: number | null = null;
    results.forEach((r, i) => {
      if (r === null) return;
      if (r) {
        run++;
        if (run >= ITEM_MASTERY_RUN && masteredAt === null) masteredAt = i;
      } else {
        run = 0;
        masteredAt = null;
      }
    });
    const tried = results.filter(r => r !== null) as boolean[];
    return {
      label: labels.get(key)!,
      results,
      tries: tried.length,
      correct: tried.filter(Boolean).length,
      mastered: masteredAt !== null,
      masteredAt,
    };
  });
}

/** How many items were mastered as of each session (oldest first), for the "items mastered" chart. */
export function masteredOverTime(history: ItemHistory[], sessionCount: number): number[] {
  return Array.from({ length: sessionCount }, (_, i) => history.filter(h => {
    // Mastered as of session i: correct the last ITEM_MASTERY_RUN tries up to and including session i.
    const upTo = h.results.slice(0, i + 1).filter(r => r !== null) as boolean[];
    return upTo.length >= ITEM_MASTERY_RUN && upTo.slice(-ITEM_MASTERY_RUN).every(Boolean);
  }).length);
}
