// Піпетка: нативний EyeDropper API (є в Chrome / Edge; у Firefox і Safari поки нема).
interface EyeDropperLike { open: () => Promise<{ sRGBHex: string }> }
type EyeDropperCtor = new () => EyeDropperLike;

export const canEyedrop = typeof window !== 'undefined' && 'EyeDropper' in window;

/** Дає вибрати колір де завгодно на екрані. null — скасував (Esc) або браузер не вміє. */
export async function eyedrop(): Promise<string | null> {
  if (!canEyedrop) return null;
  try {
    const Ctor = (window as unknown as { EyeDropper: EyeDropperCtor }).EyeDropper;
    return (await new Ctor().open()).sRGBHex;
  } catch {
    return null; // Esc
  }
}
