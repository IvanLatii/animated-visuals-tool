// File System Access API є лише в Chromium (Chrome, Edge). Типів для неї в lib.dom ще немає, тому описуємо потрібне самі.
export interface FileHandle {
  name: string;
  createWritable(): Promise<{ write(data: string | Blob): Promise<void>; close(): Promise<void> }>;
  getFile(): Promise<File>;
}

interface PickerWindow {
  showSaveFilePicker?: (opts: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileHandle>;
  showOpenFilePicker?: (opts: { types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileHandle[]>;
}

const picker = window as unknown as PickerWindow;
const TYPES = [{ description: 'Animated Visuals project', accept: { 'application/json': ['.json'] } }];

export const canPick = typeof picker.showSaveFilePicker === 'function' && typeof picker.showOpenFilePicker === 'function';

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** Вікно «Зберегти як»: Іван обирає папку й ім'я. null — скасував. */
export async function pickSaveHandle(suggestedName: string): Promise<FileHandle | null> {
  try { return await picker.showSaveFilePicker!({ suggestedName, types: TYPES }); } catch (e) { if (isAbort(e)) return null; throw e; }
}

export async function pickOpenHandle(): Promise<FileHandle | null> {
  try { return (await picker.showOpenFilePicker!({ types: TYPES }))[0] ?? null; } catch (e) { if (isAbort(e)) return null; throw e; }
}

/** Вікно «Зберегти» для експортованого файлу (MP4, GIF, PNG). null — скасував. */
export async function pickExportHandle(suggestedName: string, mime: string, ext: string): Promise<FileHandle | null> {
  try {
    return await picker.showSaveFilePicker!({ suggestedName, types: [{ description: ext.slice(1).toUpperCase(), accept: { [mime]: [ext] } }] });
  } catch (e) { if (isAbort(e)) return null; throw e; }
}

export async function writeHandle(handle: FileHandle, text: string | Blob) {
  const w = await handle.createWritable();
  await w.write(text);
  await w.close();
}

/** Запасний шлях без вікна вибору (Safari, Firefox): звичайне скачування. */
export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
