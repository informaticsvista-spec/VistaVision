// Small helpers for image input shared by the camera, upload and drawing tools.

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export function validateImageFile(file: File, maxMb: number): string | null {
  if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
    return "Please choose a JPG, PNG or WebP image.";
  }
  if (file.size > maxMb * 1024 * 1024) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${maxMb} MB. Try a smaller photo.`;
  }
  if (file.size === 0) return "That file is empty.";
  return null;
}

export const blobToObjectUrl = (blob: Blob) => URL.createObjectURL(blob);

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The image could not be displayed."));
    image.src = src;
  });
}

/** Crop a normalised rectangle out of an image blob (used for manual crop selection). */
export async function cropBlob(blob: Blob, box: { x: number; y: number; w: number; h: number }, type = "image/png"): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await loadImage(url);
    const sx = Math.round(box.x * image.naturalWidth), sy = Math.round(box.y * image.naturalHeight);
    const sw = Math.max(8, Math.round(box.w * image.naturalWidth)), sh = Math.max(8, Math.round(box.h * image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext("2d")!.drawImage(image, sx, sy, sw, sh, 0, 0, sw, sh);
    return await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Crop failed."))), type));
  } finally {
    URL.revokeObjectURL(url);
  }
}
