# Goal bank IDs: how they stay stable

Bank IDs are keyed to a persistent name mapping, so they no longer depend on the row order of the
source CSV. Outputs are written atomically, so an interrupted run cannot leave a mixed set of files.
This document describes the fixed script staged next to it. The script itself is a drop-in replacement:
same command line, same inputs, one new state file.

## The identity change

Before: `bank_id = f'bank-{i:04d}'` from the CSV row number, and `record_wording_changes` matched the
previous import by that ID under the assumption that the CSV keeps its row order between imports.
Inserting, deleting, or reordering one row renumbered every later goal, so `details.json` entries
attached to the wrong templates and the cumulative wording and type updates landed on the wrong goals.

After: identity is the goal's unique display name (the name the script already builds per goal, with
disambiguation suffixes when names collide), resolved through a persistent mapping:

- New state file: `src/lib/goal-constants/goal-bank-ids.json`, a JSON object of goal name to bankId,
  stored alongside the script's other cumulative state (the type updates, text updates, and renames
  files live in the same directory and follow the same read-at-start, write-at-end pattern).
- A goal whose name is in the mapping keeps its bankId, whatever the CSV does to row order.
- A genuinely new goal gets the next unused number: one past the highest number ever handed out, in
  the existing `bank-NNNN` format.
- A name missing from the current CSV keeps its mapping entry. IDs are never reused for a different
  goal, so a goal that disappears and later returns gets its original ID back, and a new goal can
  never inherit a deleted goal's update history.
- `record_wording_changes` and the type-update path now match on this stable identity end to end:
  wording changes match by bankId (which is now stable), and type updates were already keyed by name.
  The row-order assumption comment is gone, replaced by a description of the mapping.

## Bootstrap: the first migrated run

The mapping file does not exist yet. On the first run of the fixed script, `load_bank_ids` builds the
mapping from the current templates file (`src/lib/goal-constants/goal-bank.json`), which already
carries each template's name and bankId. The 903 current IDs are adopted unchanged, and the mapping
file is written out as part of that run's outputs.

Verified against the repo's current templates file (read-only): the bootstrap produces 903 entries,
bank-0001 through bank-0903, contiguous with no gaps, all IDs unique, round-tripping every template's
name and bankId exactly, with the next new number at 904.

First-run safety:

1. Run the first migrated import from the current master state, with the current
   `goal-bank.json` in place. Do not delete or regenerate the templates file first: it is the
   bootstrap source, and the adoption is only clean while it holds the live bank.
2. Use the same source CSV the current bank was imported from, unchanged, for the first run if it is
   available. The run should then be a no-op for identity: same names, same bankIds, and the only new
   file is `goal-bank-ids.json`. Check the review CSV and the git diff of `goal-bank.json` before
   committing; identity changes beyond formatting mean the CSV differs from the one that produced
   the current bank.
3. Commit `goal-bank-ids.json` with the run's other outputs. From then on it is the source of truth
   for identity and must never be deleted or hand-renumbered.

One caution the sandbox run below exposed: 54 of the 903 current names cannot be reproduced by
re-deriving names from the review CSV's raw goal texts (the bank has since been through `--tidy`
passes whose results live in the templates file, not in the review CSV). That is exactly why the
bootstrap reads the templates file rather than re-deriving anything, and why step 2 says to diff.

## Rename behavior

A goal whose name changes is the hard case for name keying: the old name vanishes and a new name
appears, which looks like a delete plus an add. The script handles the known case and flags the rest:

- Known renames carry over. The repo's renames file (`goal-bank-renames.json`, from/to names) is
  already one of the script's own state files, so the data was reachable with no new input channel.
  When a run's new name matches a rename's "to", the "from" name holds a bankId, and the "from" name
  is absent from the current CSV, the ID transfers to the new name and the mapping key moves with it.
- Unknown renames are flagged, never guessed. When a name vanishes and a similar name appears in the
  same run (shared skill-area suffix, or a long common prefix), the review CSV gains a
  `SUSPECTED RENAME` row naming the pair. Reconcile by editing `goal-bank-ids.json`: move the old
  name's bankId to the new name, then re-run. Nothing is transferred automatically on a suspicion.

## Atomic outputs

Before: templates, type updates, details, and review CSV were written directly over the live files in
sequence (and the wording-change files inside `record_wording_changes` the same way), so an
interrupted run left a mix of two generations.

After: every output is serialized in memory first, then swapped in with a write to a sibling `.tmp`
file followed by `os.replace`, which is atomic per file. The commit order is templates, text updates,
renames, type updates, details, review CSV, and the bankId mapping last. The mapping goes last on
purpose: it is the only file whose correctness depends on a templates file that matches it. A crash
before it lands leaves the previous, self-consistent mapping in place, and the next run re-derives
the same assignments against the old templates state. `--tidy` uses the same staged commit for its
two outputs.

## Verification performed in staging

- `python3 -m py_compile import-goal-bank.py`: clean.
- Bootstrap check against the repo's real `goal-bank.json`: 903 entries, bank-0001 through bank-0903,
  no gaps, exact round-trip (see above).
- `test_import_goal_bank.py` (in this directory): builds a fake repo in a temp directory and runs the
  real script three times. Run 1 imports three goals (bank-0001 to bank-0003). Run 2 deletes the
  middle goal and appends a new one: the survivors keep bank-0001 and bank-0003, the new goal gets
  bank-0004 (the deleted bank-0002 is not reused), the deleted goal's mapping entry survives, and the
  details keys match the template bankIds. Run 3 reorders the rows: every bankId is unchanged.
  Output ends with `PASS: bankIds are stable across deletion, insertion and reordering; deleted IDs are not reused.`
- Full-size sandbox run: the fixed script ran end to end against a staging tree whose inputs were
  symlinks to the repo's real files (the source CSV was rebuilt from `docs/goal-bank-review.csv`,
  which lacks the Purpose and activity columns, so this validates identity mechanics, not content).
  It produced 903 templates and 903 details entries. All 849 goals whose names reproduce from the raw
  texts kept their exact current bankIds; the 54 remaining goals are the post-tidy names described
  above, which a real first run (using the original CSV) does not re-derive. The renames and
  text-updates outputs were content-identical to the current files. SHA-256 hashes of every repo file
  the run could have touched were taken before and after: all unchanged, nothing was written into
  the repo tree. The script has no dry-run mode, which is why the run was pointed at the sandbox
  tree instead of the repo.
