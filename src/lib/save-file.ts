'use client';

import { toSafeErrorMessage } from './error-message';

/**
 * Saves a text file in the way that works on each platform:
 * - Android app: writes the file to a `shares` subdirectory of the app's cache and opens the share sheet (Drive, email, Files…).
 *   The Android WebView can't download files. The cache file is deleted after the share sheet closes, is
 *   cancelled, or errors, so exported student data is not left behind in the cache.
 * - Phones/tablets in a browser (iPad Home Screen app): the system share sheet ("Save to Files", AirDrop, Mail…).
 *   When the browser won't share the file it is downloaded instead: Chrome on Android refuses some file types
 *   (a backup's .json) with "Permission denied" even when canShare said yes, and refuses any share once the tap
 *   that started it is a few seconds old (a password-protected backup takes a moment to encrypt).
 * - Desktop browsers: a normal download.
 *
 * Returns false if the user cancelled the share sheet.
 */
export async function saveTextFile(fileName: string, text: string, mimeType = 'application/json'): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    // Shares live in one cache subdirectory, which is all the FileProvider exposes (see file_paths.xml).
    const cachePath = `${SHARE_CACHE_DIR}/${fileName}`;
    try {
      await Filesystem.mkdir({ path: SHARE_CACHE_DIR, directory: Directory.Cache, recursive: true });
    } catch {
      // The directory may already exist; the write below still decides whether the share can go ahead.
    }
    // The write itself used to run outside any try block, so a failure (storage full, no permission)
    // rejected with nothing catching it at this level. It is wrapped now: the caller gets a
    // sanitised error it can report, and nothing is left behind in the cache either way.
    let uri: string;
    try {
      ({ uri } = await Filesystem.writeFile({ path: cachePath, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 }));
    } catch (error) {
      throw new Error(`The file could not be written on this device: ${toSafeErrorMessage(error)}`);
    }
    try {
      await Share.share({ title: fileName, files: [uri] });
      return true;
    } catch (error) {
      if (isShareCancel(error)) return false;
      throw error;
    } finally {
      // Delete the cache file however the share ended (shared, cancelled, or failed). A failed delete
      // must never break the share or the download, so it is swallowed here.
      try {
        await Filesystem.deleteFile({ path: cachePath, directory: Directory.Cache });
      } catch {
        /* cache cleanup is best-effort */
      }
    }
  }

  const file = new File([text], fileName, { type: mimeType });
  const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return true;
    } catch (error) {
      if (isShareCancel(error)) return false;
      // Not allowed to share (see above): download it instead.
    }
  }

  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    throw new Error(`The file could not be downloaded: ${toSafeErrorMessage(error)}`);
  }
  return true;
}

/** Cache subdirectory Android shares are written to (and the only path the FileProvider exposes). */
export const SHARE_CACHE_DIR = 'shares';

function isShareCancel(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  const message = String((error as { message?: string })?.message ?? '');
  return name === 'AbortError' || /cancel/i.test(message);
}
