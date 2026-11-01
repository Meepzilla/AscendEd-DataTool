import type { GoalTemplate, GoalType } from '../types';

// The original built-in templates were written as a short sentence ("Student will produce /p/ in the initial
// position of words.") with no goal statement, so goals assigned from them had none. Their goal statements are
// written here in the goal bank's form: "By [date], the student will … with 80% accuracy across 3 consecutive
// sessions, as measured by SLP or teacher observation and data collection." The numbers are the template's target
// and the default mastery, and follow the goal's settings once assigned (see matchTextToTarget).

type BuiltInTemplate = Omit<GoalTemplate, 'id' | 'createdAt' | 'userId'>;

const MEASURED_BY = 'as measured by SLP or teacher observation and data collection';
const MEASURED_BY_STAFF = 'as measured by teacher or staff observation and data collection';
const MASTERY = 'across 3 consecutive sessions';

/** How the target is stated, for templates whose sentence doesn't state it (a leading comma joins it to the sentence). */
function criterion(type: GoalType, target: number | undefined): string {
  const t = target ?? 80;
  switch (type) {
    case 'AAC':
    case 'FEEDING_SWALLOWING':
      return `in ${t}% of opportunities`;
    case 'STORY_ELEMENTS':
      return `, with a story score of ${t}%,`;
    case 'QUALITATIVE_OBSERVATION':
    case 'COGNITIVE':
      return `, with a rating of at least ${t} out of 5,`;
    case 'COMMUNICATION_FUNCTIONS':
    case 'BEHAVIOR_FREQUENCY':
    case 'BEHAVIOR_DURATION':
    case 'BEHAVIOR_INTERVAL':
    case 'BEHAVIOR_LATENCY':
    case 'BEHAVIOR_ABC':
    case 'TASK_ANALYSIS':
      return ''; // stated in the sentence itself
    default:
      return `with ${t}% accuracy`;
  }
}

/**
 * Sentences that don't fit the pattern, or whose criterion has to be restated so it matches the goal's measure
 * (fluency is measured as % fluent syllables, so "stuttering on less than 5%" becomes "at least 95% fluent").
 */
const STATEMENTS: Record<string, string> = {
  'Request for a desired item or activity':
    'By [date], the student will spontaneously request a desired item or activity in 80% of opportunities across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Make a comment during a shared activity':
    'By [date], the student will make a spontaneous, relevant comment during a shared activity in 80% of opportunities across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Ask "Wh-" questions to gain information':
    'By [date], the student will ask a “wh-” question to gain information in 80% of opportunities across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'AAC: Use device to make a request':
    'By [date], the student will use their AAC system to spontaneously request a desired object or activity in 80% of opportunities across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'AAC: Use access method (e.g., switch, eye gaze) efficiently':
    'By [date], the student will use their prescribed access method (e.g., switch scanning, eye gaze) to select a target in 80% of trials across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Reduce stuttering frequency in conversational speech':
    'By [date], the student will speak with at least 95% fluent syllables during a 3-minute conversational speech sample across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Use easy onsets to begin speech':
    'By [date], the student will use the “easy onset” strategy to begin sentences in 8 out of 10 opportunities across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Use light articulatory contacts during reading':
    'By [date], the student will use light articulatory contacts on plosive sounds while reading a short passage, speaking with at least 80% fluent syllables across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Reduce use of interjections (e.g., "um", "uh")':
    'By [date], the student will use fewer than 3 interjections (e.g., “um,” “uh”) during a 2-minute speech sample, speaking with at least 90% fluent syllables across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Reduce secondary behaviors during moments of disfluency':
    'By [date], the student will reduce secondary behaviors (e.g., eye blinking, facial tension) during moments of stuttering, speaking with at least 80% fluent syllables across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Respond to a targeted skill (5 discrete trials)':
    'By [date], the student will respond correctly to a targeted skill with 80% accuracy over 5 discrete trials across 3 consecutive sessions, as measured by SLP or teacher observation and data collection.',
  'Behavior: ABC data to identify behavior function':
    'By [date], the student will have no more than 2 incidents of the problem behavior per session across 3 consecutive sessions, with the antecedent and consequence of each incident recorded to identify its likely function, as measured by teacher or staff observation and data collection.',
  'Behavior: Increase on-task behavior (interval)':
    'By [date], the student will be on-task in at least 80% of intervals during independent work, using momentary time sampling, across 3 consecutive sessions, as measured by teacher or staff observation and data collection.',
  'Behavior: Decrease disruptive behavior (interval)':
    'By [date], the student will engage in disruptive behavior (calling out, noises, leaving seat) in no more than 20% of intervals during instruction, using partial interval recording, across 3 consecutive sessions, as measured by teacher or staff observation and data collection.',
  'Behavior: Increase appropriate play with peers (interval)':
    'By [date], the student will play appropriately with peers for the whole interval in at least 70% of intervals during recess or centers, using whole interval recording, across 3 consecutive sessions, as measured by teacher or staff observation and data collection.',
};

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
// Straight quotes as typographic ones, as in the goal bank.
const curlyQuotes = (s: string) => s.replace(/"([^"]*)"/g, '“$1”').replace(/(\w)'(\w)/g, '$1’$2');

/** The goal statement for a built-in template written as a short sentence. */
export function builtInGoalStatement(template: BuiltInTemplate): string {
  if (STATEMENTS[template.name]) return STATEMENTS[template.name];
  const sentence = template.smartGoalPrompt.trim().replace(/\.$/, '');
  // "Student will …", "When presented with two options …, the student will …", "Given a task, student will …"
  const m = /^(.*?)\b(?:the\s+)?student will\s+(.*)$/i.exec(sentence);
  if (!m) return '';
  const lead = m[1] ? `${lowerFirst(m[1].trim().replace(/,$/, ''))}, ` : '';
  // "… during a session across 3 consecutive sessions" reads better as "… per session across …".
  const action = m[2].replace(/ during a session$/, ' per session');
  const type = template.type;
  const behavior = type.startsWith('BEHAVIOR_');
  const stated = criterion(type, template.sessionTargetValue);
  const text = `By [date], ${lead}the student will ${action}${stated.startsWith(',') || !stated ? stated : ` ${stated}`} ${MASTERY}`;
  return curlyQuotes(`${text}, ${behavior ? MEASURED_BY_STAFF : MEASURED_BY}.`);
}
