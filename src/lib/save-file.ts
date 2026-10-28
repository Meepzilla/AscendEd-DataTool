'use client';

/**
 * Saves a text file in the way that works on each platform:
 * - Android app: writes the file to the app's cache and opens the share sheet (Drive, email, Files…).
 *   The Android WebView can't download files.
 * - Phones/tablets in a browser (iPad Home Screen app): the system share sheet ("Save to Files", AirDrop, Mail…).
 * - Desktop browsers: a normal download.
 *
 * Returns false if the user cancelled the share sheet.
 */
export async function saveTextFile(fileName: string, text: string, mimeType = 'application/json'): Promise<boolean> {
  const { Capacitor } = await import('@capacitor/core');
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    const { uri } = await Filesystem.writeFile({ path: fileName, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    try {
      await Share.share({ title: fileName, files: [uri] });
      return true;
    } catch (error) {
      if (isShareCancel(error)) return false;
      throw error;
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
      throw error;
    }
  }

  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

function isShareCancel(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  const message = String((error as { message?: string })?.message ?? '');
  return name === 'AbortError' || /cancel/i.test(message);
}
