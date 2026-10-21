export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error('Не вдалося прочитати файл'));
    reader.readAsDataURL(file);
  });
}

// onload замість img.decode(): decode() у вбудованому браузері інколи не завершувався, onload — завжди.
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не вдалося відкрити картинку'));
    img.src = src;
  });
}
