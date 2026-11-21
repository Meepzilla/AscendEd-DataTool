# Security Policy

## Supported versions

The live app at https://ascended-datatool.devinllewis-git.workers.dev (built from `master`) and the latest Android APK from the repository's Actions tab are supported. Older builds are not: update to the latest and check whether the problem is still there before reporting it.

## Reporting a vulnerability

Email devinllewis+git@pm.me with a description of the problem, the steps to reproduce it, and the version or date of the build you tested. Include screenshots or a short recording if they help.

Do not include real student data in a report. Use invented names and example goals.

Do not disclose the problem publicly until it is fixed. I will acknowledge your report, confirm the issue, and let you know when a fix is out. If you want credit for the report, say so and I will name you in the changelog.

## Scope

The web app and the Android app are in scope, including the passcode and PIN protection, encrypted storage, backups, imports and exports, and the build and hosting setup.

## What the app does with your data

The app runs entirely on the device. There is no account and no server, and student data is never sent anywhere. A vulnerability report never needs to include student data, and one that does will be deleted.

## Security practices

- Dependencies are updated monthly through Dependabot, with security fixes applied as soon as they arrive.
- CodeQL code scanning runs on the repository.
- The static build adds a strict Content Security Policy (only the app's own files and scripts, no pictures, fonts or other content from other sites, forms sent only to the app) and security headers, and the build fails if any of them is missing.
- The Android app keeps student data out of Android's cloud backup and, on Android 12 and later, out of phone-to-phone transfer.
- Imported files are size-checked before they are opened, including the unpacked and declared sizes of an Excel workbook; a backup over 50 MB is refused. Imported and restored data is checked where it comes in: impossible dates, unknown goal types and out-of-range values are rejected or left out, and the app says what was left out.
- Damaged passcode or PIN settings make unlocking fail straight away with a clear message, and the key-strength setting is capped, so a tampered setting can't freeze the app.
- Saves that fail (for example, when storage is full) are reported and the entries are kept; the app never reports a failed save as successful.
- Record IDs come from the browser's cryptographic random number generator.
- The GitHub Actions workflows run with a read-only token.
- The Android release APK is signed with a private release key kept in the repository's secrets. No signing key is kept in the repository.
