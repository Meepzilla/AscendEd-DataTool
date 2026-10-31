#!/usr/bin/env python3
"""
Imports an SLP goal bank CSV as built-in goal templates. The CSV itself is not kept in the repository.

For each goal it decides the data collection type (which data entry screen the goal uses) and the
session target, from the goal's skill area and how its text says success is measured. It writes:

  src/lib/goal-constants/goal-bank.json   templates bundled with the app
  public/goal-bank/details.json           purpose, activity ideas and tags, loaded on demand
  docs/goal-bank-review.csv               every goal with its type, target and the reason, for review

Run from the repository root:  python3 scripts/import-goal-bank.py path/to/SLP_Goal_Bank.csv
"""
import csv
import json
import re
import sys
from collections import Counter

TEMPLATES_OUT = 'src/lib/goal-constants/goal-bank.json'
# Every type change between imports, so devices that stored the old version can be updated
# (see applyDefaultTemplateUpdates). Cumulative: entries are only ever added.
TYPE_UPDATES_OUT = 'src/lib/goal-constants/goal-bank-type-updates.json'
DETAILS_OUT = 'public/goal-bank/details.json'
REVIEW_OUT = 'docs/goal-bank-review.csv'
MAX_NAME = 90

TYPE_LABELS = {
    'ARTICULATION': 'Articulation', 'PHONOLOGICAL_PROCESSES': 'Phonological Processes',
    'FLUENCY_SYLLABLE_STUTTER': 'Fluency Syllable Stutter', 'LANGUAGE_COMPREHENSION': 'Language Comprehension',
    'LANGUAGE_EXPRESSION': 'Language Expression', 'AAC': 'AAC', 'DISCRETE_TRIALS': 'Discrete Trials',
    'FEEDING_SWALLOWING': 'Feeding Swallowing', 'QUALITATIVE_OBSERVATION': 'Qualitative Observation',
    'COGNITIVE': 'Cognitive', 'COMMUNICATION_FUNCTIONS': 'Communication Functions', 'STORY_CHAMPS': 'Story Elements',
    'BEHAVIOR_FREQUENCY': 'Behavior Frequency', 'BEHAVIOR_DURATION': 'Behavior Duration', 'BEHAVIOR_ABC': 'Behavior ABC',
}

RECEPTIVE_AREAS = {'Receptive Language', 'Auditory Discrimination', 'Reading Comprehension & Symbols', 'Nonverbal, Figurative & Inference', 'Figurative Language'}
EXPRESSIVE_AREAS = {'Expressive Language', 'Written Expression', 'Written Language', 'Language'}
AAC_AREAS = {'AAC Access & Navigation', 'DAGG-3 Operational', 'DAGG-3 Linguistic', 'SETT Tools'}
# Communication shown in naturally occurring opportunities: each opportunity is marked as a trial.
OPPORTUNITY_AREAS = {
    'Social Skills & Pragmatics', 'Functional Communication', 'Functional Life Skills', 'Group & Social Norms',
    'Classroom, Community & Vocational', 'Self-Advocacy, Persuasion & Problem Solving', 'Conversation: Turns & Topic',
    'Behavior Replacement & Regulation', 'Health, Safety & Independence', 'Initiating & Questions',
    'Multi-Function Communication', 'Clarification & Repair', 'Aided Language & Multi-Modal Communication',
    'Perspective & Empathy', 'Audience & Register', 'Hearing', 'Illocutionary Communication', 'Prelocutionary Communication',
    'Unconventional Communication', 'Conventional Communication', 'Concrete Symbols', 'Abstract Symbols',
    'Emergent Linguistic Communication', 'DAGG-3 Social', 'DAGG-3 Strategic', 'SETT Student', 'SETT Environment', 'SETT Tasks',
}

FUNCTION_WORDS = ['reject', 'request', 'be social', 'share information', 'comment', 'protest', 'greet']


def has(text, *patterns):
    return any(re.search(p, text) for p in patterns)


def classify_behavior(area, text):
    """Behavior data goals: returns (goal type, direction, reason) or None."""
    t = text.lower()
    if area == 'Behavior Replacement & Regulation':
        return 'BEHAVIOR_ABC', 'increase', 'Replacement skill vs problem behavior per triggering incident (ABC data); target is % of incidents with the replacement skill'
    if has(t, r'(parallel play|joint attention|sustain engagement|cooperative play|attend to structured)[^.]*?for (\[x\]|x|___|\d+)( number of)? minutes'):
        return 'BEHAVIOR_DURATION', 'increase', 'Measured as time engaged (duration); target is minutes'
    if has(t, r'decreasing the use of [^.]*? to (\[x\]|x|___|\d+) occurrences', r'no more than (___|\[x\]|x|\d+) (number of )?redirections'):
        return 'BEHAVIOR_FREQUENCY', 'decrease', 'Counts occurrences to reduce (frequency); target is the most allowed per session'
    if has(t, r'request (\[x\]|x|___|\d+) preferred items or actions per session', r'make (\d+) appropriate communicative utterances'):
        return 'BEHAVIOR_FREQUENCY', 'increase', 'Counts occurrences per session (frequency); target is the number per session'
    return None


def classify(area, text):
    """Returns (goal type, reason)."""
    t = text.lower()
    accuracy = has(t, r'\d+\s*% accuracy', r'___\s*% accuracy', r'accuracy')

    # Rules that depend on what the goal measures, regardless of skill area.
    listed = [w for w in FUNCTION_WORDS if w in t]
    if 'aided language input' in t and len(listed) >= 2:
        return 'COMMUNICATION_FUNCTIONS', 'Counts use of several communicative functions per instructional period'
    if has(t, r'tell (their|a) story', r'retell the event or story') and has(t, r'details|sequenc|order'):
        return 'STORY_CHAMPS', 'Story told with its parts in order; scored by story part'
    if area == 'Partner Strategies' or 'fidelity checklist' in t:
        return 'QUALITATIVE_OBSERVATION', 'Partner fidelity is rated, not counted'

    if area == 'Dysphagia & Swallowing':
        return 'FEEDING_SWALLOWING', 'Feeding/swallowing goal: trials accepted vs refused'
    if area in ('Articulation', 'Intelligibility'):
        return 'ARTICULATION', 'Speech sound accuracy: correct, approximate and incorrect productions'
    if area == 'Phonology':
        return 'PHONOLOGICAL_PROCESSES', 'Target phonological process: correct vs incorrect productions'
    if area == 'Phonological Awareness':
        return 'LANGUAGE_COMPREHENSION', 'Sound identification tasks scored correct/incorrect'
    if area == 'Fluency':
        if has(t, r'minimize disfluencies', r'reduce repetitions', r'reduce (each of )?their secondary'):
            return 'FLUENCY_SYLLABLE_STUTTER', 'Measures disfluencies in speech'
        if has(t, r'identify', r'name and describe'):
            return 'LANGUAGE_COMPREHENSION', 'Identifying or naming fluency features, scored correct/incorrect'
        if 'aac' in t:
            return 'AAC', 'AAC phrase building, scored correct/incorrect'
        if has(t, r'technique', r'method'):
            return 'LANGUAGE_EXPRESSION', 'Correct use of a fluency technique'
        return 'QUALITATIVE_OBSERVATION', 'Prosody, rate or voice quality is rated'
    if area == 'Speech & Voice':
        if has(t, r'imitate', r'oral-motor', r'articulat'):
            return 'ARTICULATION', 'Speech/oral-motor productions scored correct/incorrect'
        if has(t, r'breakdown', r'repeat or rephrase'):
            return 'DISCRETE_TRIALS', 'Each communication breakdown is an opportunity'
        return 'QUALITATIVE_OBSERVATION', 'Voice quality, volume or rate is rated'
    if area == 'Cognition, Memory & Problem Solving':
        if accuracy and has(t, r'\d+\s*%'):
            return 'LANGUAGE_COMPREHENSION', 'Cognitive-linguistic task with an accuracy criterion'
        return 'COGNITIVE', 'Cognitive skill rated 1-5 with notes'
    if area in RECEPTIVE_AREAS:
        return 'LANGUAGE_COMPREHENSION', 'Receptive/comprehension responses scored correct/incorrect'
    if area in EXPRESSIVE_AREAS:
        if 'aac' in t and not accuracy:
            return 'AAC', 'Expressive goal using AAC, scored correct/incorrect'
        return 'LANGUAGE_EXPRESSION', 'Expressive responses scored correct/incorrect'
    if area in AAC_AREAS:
        return 'AAC', 'AAC use, scored correct/approximate/incorrect'
    if area in OPPORTUNITY_AREAS:
        if accuracy and has(t, r'given (\d+|a list|\w+ (words|pictures|symbols|sentences|examples))'):
            return 'LANGUAGE_COMPREHENSION' if has(t, r'identify|match|recogni|understand|interpret') else 'LANGUAGE_EXPRESSION', \
                'Structured task scored correct/incorrect'
        return 'DISCRETE_TRIALS', 'Each opportunity is marked correct, approximate or incorrect'
    return 'DISCRETE_TRIALS', 'Default: each opportunity is marked'


def target_for(goal_type, text):
    t = text.lower()
    if goal_type == 'BEHAVIOR_DURATION':
        m = re.search(r'for (\d+) (?:consecutive )?minutes', t)
        return int(m.group(1)) if m else 5
    if goal_type == 'BEHAVIOR_FREQUENCY':
        m = re.search(r'(?:make|request|to|no more than) (\d+) ', t)
        if m:
            return int(m.group(1))
        return 3 if 'redirection' in t else 2 if 'occurrences' in t else 5
    if goal_type == 'COMMUNICATION_FUNCTIONS':
        m = re.search(r'at least (\d+) times', t)
        return int(m.group(1)) if m else 3
    if goal_type in ('QUALITATIVE_OBSERVATION', 'COGNITIVE'):
        return 4
    m = re.search(r'(\d{2,3})\s*%', t)
    if m:
        return min(100, int(m.group(1)))
    m = re.search(r'(\d+)\s+(?:out\s+)?of\s+(\d+)', t)
    if m and int(m.group(2)) > 0:
        return round(int(m.group(1)) / int(m.group(2)) * 100)
    return 80


def target_label(goal_type, target, direction):
    sign = '≤' if direction == 'decrease' else '≥'
    if goal_type == 'BEHAVIOR_FREQUENCY':
        return f'{sign} {target} per session'
    if goal_type == 'BEHAVIOR_DURATION':
        return f'{sign} {target} min'
    if goal_type == 'BEHAVIOR_ABC':
        return f'≥ {target}% replacement skill' if direction == 'increase' else f'≤ {target} incidents'
    if goal_type == 'COMMUNICATION_FUNCTIONS':
        return f'{target} functions'
    if goal_type in ('QUALITATIVE_OBSERVATION', 'COGNITIVE'):
        return f'{target} (1-5 rating)'
    return f'{target}%'


def make_name(text):
    """A short name from the goal text: what the student will do, without the criteria."""
    m = re.search(r'\b(?:will|shall)\s+(.*)', text, re.I)
    s = m.group(1) if m else text
    s = re.split(r',\s*as measured| as measured| with (?:\d+|___|_+)\s*%| (?:in|across|within) (?:at least )?(?:\d+|___|_+)\b|\s+with\s+\d+\s+(?:out\s+)?of\s+\d+|\s+wit \d', s, maxsplit=1)[0]
    s = re.sub(r'\s+', ' ', s).strip(' ,.;')
    s = re.sub(r'^(independently|appropriately|accurately)\s+', '', s, flags=re.I)
    if len(s) > MAX_NAME:
        s = s[:MAX_NAME].rsplit(' ', 1)[0].rstrip(' ,;(') + '…'
    return s[:1].upper() + s[1:]


def norm(word):
    return re.sub(r'[^\w/-]', '', word.lower())


SMALL_WORDS = {'a', 'an', 'the', 'and', 'or', 'of', 'that', 'to', 'in', 'with', 'for', 'on'}


def distinguishing_phrase(text, others):
    """The first phrase in `text` (up to 4 meaningful words) made of words that appear in none of `others`.
    Small words such as "an" or "the" may sit inside the phrase; an example in brackets ends it."""
    other_words = {norm(w) for o in others for w in o.split()}
    words = text.split()
    for i, w in enumerate(words):
        if not norm(w) or norm(w) in other_words:
            continue
        run, meaningful = [w], 1
        for nxt in words[i + 1:i + 8]:
            if nxt.startswith('(') or meaningful >= 4:
                break
            if norm(nxt) in SMALL_WORDS:
                run.append(nxt)
            elif norm(nxt) and norm(nxt) not in other_words:
                run.append(nxt)
                meaningful += 1
            else:
                break
        while run and norm(run[-1]) in SMALL_WORDS:
            run.pop()
        return ' '.join(run).strip(' ,.;:()"“”\'')
    return ''


def first_sentence(text):
    m = re.match(r'(.+?[.!?])(\s|$)', text.strip())
    return (m.group(1) if m else text).strip()


def main():
    if len(sys.argv) != 2:
        sys.exit('Usage: python3 scripts/import-goal-bank.py path/to/SLP_Goal_Bank.csv')
    rows = list(csv.DictReader(open(sys.argv[1], newline='', encoding='utf-8-sig')))
    try:
        previous_types = {t['name']: t['type'] for t in json.load(open(TEMPLATES_OUT))}
    except FileNotFoundError:
        previous_types = {}
    try:
        type_updates = json.load(open(TYPE_UPDATES_OUT))
    except FileNotFoundError:
        type_updates = []
    existing = set(re.findall(r"name: '((?:[^'\\]|\\.)*)'", ''.join(
        open(f'src/lib/goal-constants/{f}.ts').read() for f in
        ['articulation', 'fluency', 'language', 'observation', 'phonological', 'trials', 'feeding', 'aac', 'cognitive', 'communication', 'story-champs'])))
    groups = {}
    for r in rows:
        groups.setdefault(make_name(r['Goal text']), []).append(r['Goal text'])
    used = set(existing)
    templates, details, review = [], {}, []
    for i, r in enumerate(rows, 1):
        text = re.sub(r'\s+', ' ', r['Goal text']).strip()
        behavior = classify_behavior(r['Skill area'], text)
        if behavior:
            goal_type, direction, reason = behavior
        else:
            (goal_type, reason), direction = classify(r['Skill area'], text), None
        name = make_name(text)
        siblings = [g for g in groups[name] if g != r['Goal text']]
        if siblings:
            # Goals that would share a name: add what sets this one apart.
            phrase = distinguishing_phrase(r['Goal text'], siblings)
            name = f'{name} ({phrase})' if phrase else name
        if name in used:
            name = f"{name} ({r['Skill area']})"
        n, base = 2, name
        while name in used:
            name, n = f'{base} #{n}', n + 1
        used.add(name)
        bank_id = f'bank-{i:04d}'
        target = target_for(goal_type, text)
        old_type = previous_types.get(name)
        if old_type and old_type != goal_type and {'name': name, 'fromType': old_type} not in type_updates:
            type_updates.append({'name': name, 'fromType': old_type})
        templates.append({
            'name': name, 'type': goal_type, 'isDefault': True, 'sessionTargetValue': target,
            **({'targetDirection': direction} if direction else {}),
            'smartGoalPrompt': first_sentence(r['Purpose']) if r['Purpose'].strip() else text,
            'generatedSmartGoal': text, 'category': r['Skill area'], 'source': r['Set'], 'bankId': bank_id,
        })
        tags = {k: r[k] for k in ['Communication function', 'Modality', 'Context', 'Partner', 'Independence', 'Supports', 'Complexity'] if r[k].strip()}
        details[bank_id] = {'purpose': r['Purpose'].strip(), 'activityIdeas': [a.strip() for a in (r['Activity idea 1'], r['Activity idea 2']) if a.strip()], 'tags': tags}
        review.append({'Set': r['Set'], 'Skill area': r['Skill area'], 'Template name': name, 'Data type': TYPE_LABELS[goal_type],
                       'Target': target_label(goal_type, target, direction),
                       'Why': reason, 'Goal text': text})

    json.dump(templates, open(TEMPLATES_OUT, 'w'), ensure_ascii=False, indent=0)
    json.dump(type_updates, open(TYPE_UPDATES_OUT, 'w'), ensure_ascii=False, indent=1)
    json.dump(details, open(DETAILS_OUT, 'w'), ensure_ascii=False, separators=(',', ':'))
    with open(REVIEW_OUT, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.DictWriter(fh, fieldnames=list(review[0].keys()))
        w.writeheader()
        w.writerows(review)
    print(f'{len(templates)} templates, {len(type_updates)} recorded type changes')
    for k, v in Counter(t['type'] for t in templates).most_common():
        print(f'  {v:4}  {TYPE_LABELS[k]}')


if __name__ == '__main__':
    main()
