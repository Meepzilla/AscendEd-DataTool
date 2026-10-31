import type { Goal, GoalTemplate, Student } from './types';
import { generateUUID } from './helpers';

/** A student goal made from a template. */
export function goalFromTemplate(template: GoalTemplate): Goal {
  return {
    id: generateUUID(),
    templateId: template.id,
    name: template.name,
    type: template.type,
    dataCaptureType: template.dataCaptureType,
    smartGoal: template.generatedSmartGoal || `SMART goal for ${template.name}`,
    sessionTargetValue: template.sessionTargetValue,
    targetDirection: template.targetDirection,
    ...(template.taskSteps?.length ? { taskSteps: [...template.taskSteps] } : {}),
  };
}

/**
 * Whether the student already has a goal from this template. Goals are copies that can be edited for the student,
 * so they are matched by the template they came from (templateId), or, for goals assigned before that was kept,
 * by name and type.
 */
export function hasTemplateGoal(student: Pick<Student, 'goals'>, template: Pick<GoalTemplate, 'id' | 'name' | 'type'>): boolean {
  return (student.goals || []).some(g => g.templateId
    ? g.templateId === template.id
    : g.name === template.name && g.type === template.type);
}

/**
 * Gives goals assigned before templateId was kept the id of the template they match by name and type (only when
 * exactly one template matches), so later renames of the student's copy don't hide where it came from.
 */
export function linkGoalsToTemplates<T extends Pick<Student, 'goals'>>(students: T[], templates: Pick<GoalTemplate, 'id' | 'name' | 'type'>[]): { students: T[]; changed: boolean } {
  let changed = false;
  const byKey = new Map<string, string[]>();
  templates.forEach(t => {
    const key = `${t.type}|${t.name}`;
    byKey.set(key, [...(byKey.get(key) || []), t.id]);
  });
  const linked = students.map(student => {
    let studentChanged = false;
    const goals = (student.goals || []).map(goal => {
      if (goal.templateId) return goal;
      const ids = byKey.get(`${goal.type}|${goal.name}`);
      if (!ids || ids.length !== 1) return goal;
      studentChanged = true;
      return { ...goal, templateId: ids[0] };
    });
    if (!studentChanged) return student;
    changed = true;
    return { ...student, goals };
  });
  return { students: linked, changed };
}

// ---- Recently assigned templates (per device, a convenience for the goal pickers) ----

const RECENT_KEY = 'ascended_recent_templates_v1_';
const RECENT_LIMIT = 12;

export function getRecentTemplateIds(userId: string | undefined): string[] {
  try {
    const ids = JSON.parse(localStorage.getItem(RECENT_KEY + (userId || 'guest')) || '[]');
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function recordRecentTemplates(userId: string | undefined, templateIds: string[]) {
  if (templateIds.length === 0) return;
  try {
    const ids = [...templateIds, ...getRecentTemplateIds(userId).filter(id => !templateIds.includes(id))].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY + (userId || 'guest'), JSON.stringify(ids));
  } catch {
    // Storage unavailable: the picker just has no recent list.
  }
}

// ---- Duplicate templates ----

// Words that say nothing about what a goal targets.
const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'to', 'in', 'on', 'at', 'by', 'for', 'and', 'or', 'with', 'e', 'g', 'eg', 'i', 'ie', 'etc', 'student', 'will']);

function nameTokens(name: string): Set<string> {
  const words = name
    .toLowerCase()
    .replace(/(…|\.\.\.)$/, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(w => w && !STOP_WORDS.has(w));
  return new Set(words);
}

/**
 * Whether two names differ only in wording that does not change the goal: the same words (ignoring case,
 * punctuation, word order and filler words), or one extra word that is not a number or a single sound,
 * e.g. "Follow 2-step related directions" and "Follow the directions (2-step)". Names that differ in what
 * they target ("/p/" vs "/b/", "(present)" vs "(past)") differ in at least two words and stay apart.
 */
function similarNames(a: Set<string>, b: Set<string>): boolean {
  if (Math.abs(a.size - b.size) > 1) return false;
  const diff = [...a].filter(w => !b.has(w)).concat([...b].filter(w => !a.has(w)));
  if (diff.length === 0) return a.size > 0;
  return diff.length === 1 && Math.min(a.size, b.size) >= 4 && diff[0].length >= 4 && !/\d/.test(diff[0]);
}

const goalText = (text?: string) => (text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/**
 * Groups of goal templates that look like duplicates: names that differ only in filler wording (see
 * similarNames), or the same full SMART goal text. Archived templates are left out. Largest groups first.
 */
export function findDuplicateGroups<T extends Pick<GoalTemplate, 'id' | 'name' | 'isArchived' | 'generatedSmartGoal'>>(templates: T[]): T[][] {
  const active = templates.filter(t => !t.isArchived);
  const tokens = active.map(t => nameTokens(t.name));
  const parent = active.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const join = (i: number, j: number) => { parent[find(j)] = find(i); };

  // Only names that share a word can be similar, so compare within each word's list.
  const byWord = new Map<string, number[]>();
  tokens.forEach((set, i) => set.forEach(w => byWord.set(w, [...(byWord.get(w) || []), i])));
  // A shortened name ("…") may have been cut before the words that tell two goals apart, so those are
  // only matched by an identical name or by their full goal text (below).
  const shortened = active.map(t => /(…|\.\.\.)$/.test(t.name.trim()));
  tokens.forEach((a, i) => {
    const candidates = new Set<number>();
    a.forEach(w => byWord.get(w)!.forEach(j => { if (j > i) candidates.add(j); }));
    candidates.forEach(j => {
      if (shortened[i] || shortened[j]) {
        if (active[i].name.trim().toLowerCase() === active[j].name.trim().toLowerCase()) join(i, j);
      } else if (similarNames(a, tokens[j])) join(i, j);
    });
  });

  // The same full goal under different names.
  const byText = new Map<string, number>();
  active.forEach((t, i) => {
    const text = goalText(t.generatedSmartGoal);
    if (text.length < 40) return;
    if (byText.has(text)) join(byText.get(text)!, i);
    else byText.set(text, i);
  });

  const groups = new Map<number, T[]>();
  active.forEach((t, i) => groups.set(find(i), [...(groups.get(find(i)) || []), t]));
  return [...groups.values()].filter(g => g.length > 1).sort((a, b) => b.length - a.length || a[0].name.localeCompare(b[0].name));
}
