#!/usr/bin/env python3
"""
Self-test for the fixed import-goal-bank.py bankId stability.

Builds a tiny fake repository in a temp directory (the script resolves every output path relative to
the current directory and reads the goal-type names from src/lib/goal-constants/*.ts), then runs the
real script three times:

  run 1: three goals A, B, C           -> bank-0001, bank-0002, bank-0003 (bootstrap: no mapping yet,
                                          previous templates empty, so IDs are handed out in order)
  run 2: B deleted, D appended         -> A and C keep bank-0001 / bank-0003, D gets bank-0004
                                          (the deleted goal's bank-0002 is NOT reused), and the mapping
                                          still holds B's entry
  run 3: rows reordered (D, C, A)      -> every goal keeps its run-2 bankId

Run:  python3 test_import_goal_bank.py
"""
import csv
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, 'import-goal-bank.py')

HEADER = ['Set', 'Skill area', 'Goal text', 'Purpose', 'Activity idea 1', 'Activity idea 2',
          'Communication function', 'Modality', 'Context', 'Partner', 'Independence', 'Supports',
          'Complexity']

TS_FILES = ['articulation', 'fluency', 'language', 'observation', 'phonological', 'trials',
            'feeding', 'aac', 'cognitive', 'communication', 'story-elements']

GOALS = {
    'A': ('Expressive Language', 'The student will name common objects with 80% accuracy.'),
    'B': ('Receptive Language', 'The student will follow one-step directions with 80% accuracy.'),
    'C': ('Articulation', 'The student will produce the /s/ sound in words with 80% accuracy.'),
    'D': ('Expressive Language', 'The student will use two-word phrases with 80% accuracy.'),
}


def write_csv(path, keys):
    with open(path, 'w', newline='', encoding='utf-8-sig') as fh:
        w = csv.DictWriter(fh, fieldnames=HEADER)
        w.writeheader()
        for k in keys:
            area, text = GOALS[k]
            row = {h: '' for h in HEADER}
            row.update({'Set': 'SelfTest', 'Skill area': area, 'Goal text': text, 'Purpose': text})
            w.writerow(row)


def run_import(root, keys):
    csv_path = os.path.join(root, 'bank.csv')
    write_csv(csv_path, keys)
    out = subprocess.run([sys.executable, SCRIPT, csv_path], cwd=root,
                         capture_output=True, text=True)
    assert out.returncode == 0, f'import failed:\n{out.stdout}\n{out.stderr}'
    templates = json.load(open(os.path.join(root, 'src/lib/goal-constants/goal-bank.json')))
    mapping = json.load(open(os.path.join(root, 'src/lib/goal-constants/goal-bank-ids.json')))
    details = json.load(open(os.path.join(root, 'public/goal-bank/details.json')))
    return {t['name']: t['bankId'] for t in templates}, mapping, details


def main():
    with tempfile.TemporaryDirectory() as root:
        for d in ['src/lib/goal-constants', 'public/goal-bank', 'docs']:
            os.makedirs(os.path.join(root, d))
        for f in TS_FILES:  # the script scans these for hand-written template names
            open(os.path.join(root, 'src/lib/goal-constants', f'{f}.ts'), 'w').write('export const x = [];\n')

        ids1, map1, _ = run_import(root, ['A', 'B', 'C'])
        names = sorted(ids1, key=ids1.get)
        print('run 1 (A, B, C):', {k: ids1[n] for k, n in zip('ABC', names)})
        assert [ids1[n] for n in names] == ['bank-0001', 'bank-0002', 'bank-0003'], ids1
        name_a, name_b, name_c = names

        ids2, map2, det2 = run_import(root, ['A', 'C', 'D'])
        print('run 2 (B deleted, D appended):', ids2)
        assert ids2[name_a] == 'bank-0001', 'A lost its bankId'
        assert ids2[name_c] == 'bank-0003', 'C was renumbered after the row above it was deleted'
        new_names = [n for n in ids2 if n not in ids1]
        assert len(new_names) == 1 and ids2[new_names[0]] == 'bank-0004', \
            f'new goal should get the next unused ID bank-0004, got {ids2}'
        assert map2[name_b] == 'bank-0002', 'deleted goal lost its mapping entry (its ID could be reused)'
        assert set(det2) == set(ids2.values()), 'details.json keys do not match the templates bankIds'

        ids3, _, _ = run_import(root, ['D', 'C', 'A'])
        print('run 3 (reordered D, C, A):', ids3)
        assert ids3 == ids2, f'reordering rows changed bankIds: {ids2} -> {ids3}'

    print('PASS: bankIds are stable across deletion, insertion and reordering; deleted IDs are not reused.')


if __name__ == '__main__':
    main()
