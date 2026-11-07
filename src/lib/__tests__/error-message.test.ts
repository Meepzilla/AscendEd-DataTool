import { describe, expect, it } from 'vitest';
import { GENERIC_ERROR_MESSAGE, sanitizeErrorMessage, toSafeErrorMessage } from '../error-message';

describe('sanitizeErrorMessage', () => {
  it('strips a UUID wherever it appears', () => {
    expect(sanitizeErrorMessage('Saving failed for 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.'))
      .toBe('Saving failed for [redacted].');
    expect(sanitizeErrorMessage('9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'))
      .toBe('[redacted]');
  });

  it('strips labelled student, session and goal IDs', () => {
    expect(sanitizeErrorMessage('Session state missing. Student ID: 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'))
      .toBe('Session state missing. Student ID: [redacted]');
    expect(sanitizeErrorMessage('Row for session S-12345 is missing required fields.'))
      .toBe('Row for a session is missing required fields.');
    expect(sanitizeErrorMessage('Failed for sessionId: abc-123, goalId=goal-9'))
      .toBe('Failed for sessionId: [redacted], goalId: [redacted]');
  });

  it('strips email addresses', () => {
    expect(sanitizeErrorMessage('Could not reach guest@local.com'))
      .toBe('Could not reach [redacted]');
  });

  it('leaves a plain message untouched', () => {
    expect(sanitizeErrorMessage("This device's storage is full, so the change was not saved."))
      .toBe("This device's storage is full, so the change was not saved.");
    expect(sanitizeErrorMessage('Could not parse session data from CSV file. Please check the file format.'))
      .toBe('Could not parse session data from CSV file. Please check the file format.');
  });
});

describe('toSafeErrorMessage', () => {
  it('returns the sanitised message of an Error', () => {
    expect(toSafeErrorMessage(new Error('Row for session abc-1 is missing required fields.')))
      .toBe('Row for a session is missing required fields.');
  });

  it('falls back to a generic message for an empty or non-text error', () => {
    expect(toSafeErrorMessage(new Error(''))).toBe('An unexpected error occurred.');
    expect(toSafeErrorMessage(undefined)).toBe('An unexpected error occurred.');
    expect(toSafeErrorMessage({})).toBe('An unexpected error occurred.');
  });
});

describe('GENERIC_ERROR_MESSAGE', () => {
  it('reassures that data stays saved', () => {
    expect(GENERIC_ERROR_MESSAGE).toContain('still saved');
  });
});
