// ----------------------------------------------------------------------
// Image compression for uploads (camera photos, scans, receipts).
//
// Phone cameras produce 3-8MB files; for farmer ID photos and receipts
// ~1920px on the long edge is still print quality (~300dpi at 16cm) while
// cutting uploads to a few hundred KB — faster upload on slow networks
// and far less Firebase Storage usage.
// ----------------------------------------------------------------------

const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 0.72;
/** Files at or below this size are uploaded as-is (already small enough). */
const MIN_SIZE_BYTES = 300 * 1024;

async function decode(file: File): Promise<{ width: number; height: number; draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; close: () => void } | null> {
  // createImageBitmap handles EXIF orientation on modern browsers.
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  }

  // Fallback for browsers without createImageBitmap (older Safari).
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return {
      width: img.naturalWidth,
      height: img.naturalHeight,
      draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h),
      close: () => {},
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Returns a smaller JPEG `File` for image inputs, or the original file when
 * compression does not apply (non-images, already-small files, undecodable
 * formats like some HEIC files — uploaded as-is rather than failing).
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= MIN_SIZE_BYTES) return file;

  try {
    const source = await decode(file);
    if (!source) return file;

    const scale = Math.min(1, MAX_DIMENSION / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // White backing so transparent PNGs don't flatten to black in JPEG.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    source.draw(ctx, width, height);
    source.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
    );
    if (!blob || blob.size >= file.size) return file;

    const name = `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } catch {
    return file;
  }
}
