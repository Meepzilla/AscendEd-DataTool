import type { GoalTemplate, Student } from './types';
import { generateUUID } from './helpers';
import { linkGoalsToTemplates } from './goal-templates';
import {
  DEFAULT_GOAL_TEMPLATES, defaultTemplateKey, applyAssignedGoalRenames, applyDefaultTemplateRenames,
  applyDefaultTemplateRetirements, applyDefaultTemplateUpdates, applyDefaultTemplateTextUpdates, applyAssignedGoalStatements,
} from './goal-constants';
import { byName } from './data-store';

// Brings stored students and templates up to date when the app loads: renamed and retired built-in templates,
// changed goal types, the built-in templates the device doesn't have yet, and goals linked to their templates.

export interface PreparedData {
  /** Students with renamed built-in goals, sorted; save them when studentsChanged. */
  students: Student[];
  studentsChanged: boolean;
  /** Templates with every update and the missing built-in templates added, sorted; save them when templatesChanged. */
  templates: GoalTemplate[];
  templatesChanged: boolean;
  /** Students with goals linked to their templates or given their template's goal statement, when any were (saved after the templates). */
  linkedStudents: Student[] | null;
}

export function prepareLoadedData(rawStudents: Student[], rawTemplates: GoalTemplate[], userId: string): PreparedData {
  const { students: renamedStudents, changed: studentsChanged } = applyAssignedGoalRenames<Student>(rawStudents);
  const students = [...renamedStudents].sort(byName);

  const { templates: renamedTemplates, changed: templatesRenamed } = applyDefaultTemplateRenames<GoalTemplate>(
    rawTemplates.map(t => ({ ...t, createdAt: new Date(t.createdAt) })),
  );
  const { templates: updatedTypes, changed: typesUpdated } = applyDefaultTemplateUpdates<GoalTemplate>(renamedTemplates);
  const { templates: updatedText, changed: textUpdated } = applyDefaultTemplateTextUpdates<GoalTemplate>(updatedTypes);
  const { templates: retiredTemplates, changed: templatesRetired } = applyDefaultTemplateRetirements<GoalTemplate>(updatedText);
  // Built-in templates stored before defaultKey existed get it now (their current name), so renaming one later
  // doesn't bring the original back.
  let keysAdded = false;
  const localTemplates = retiredTemplates.map(t => {
    if (!t.isDefault || t.defaultKey) return t;
    keysAdded = true;
    return { ...t, defaultKey: t.name };
  });
  // Built-in templates are matched by the name they were added under (defaultKey), so one the user renamed
  // isn't added again under its original name.
  const existingDefaultNames = new Set(localTemplates.filter(t => t.isDefault).map(defaultTemplateKey));
  const missingDefaultTemplates = DEFAULT_GOAL_TEMPLATES
    .filter(defaultTemplate => !existingDefaultNames.has(defaultTemplate.name))
    .map(t => ({ ...t, defaultKey: t.name, id: generateUUID(), createdAt: new Date(), userId: userId || 'local-user' }));
  const templates = [...localTemplates, ...missingDefaultTemplates].sort(byName);
  const templatesChanged = missingDefaultTemplates.length > 0 || templatesRenamed || typesUpdated || textUpdated || templatesRetired || keysAdded;

  // Goals assigned before they kept their template's id get it now (see linkGoalsToTemplates).
  const { students: linked, changed: goalsLinked } = linkGoalsToTemplates(students, templates);
  // Goals given a placeholder statement get their template's statement (applyAssignedGoalStatements).
  const { students: withStatements, changed: statementsAdded } = applyAssignedGoalStatements(linked, templates);

  return { students, studentsChanged, templates, templatesChanged, linkedStudents: goalsLinked || statementsAdded ? withStatements : null };
}
