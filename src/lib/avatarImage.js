// Client-side avatar preprocessing: validate file type/size, then
// downscale + recompress to a square JPEG data URL so we can persist it
// in the existing `application.photo` String column without any new
// backend route or storage backend changes.

export const MAX_INPUT_BYTES = 8 * 1024 * 1024; // 8 MB raw upload cap
export const OUTPUT_SIZE = 256;                 // px (square)
export const OUTPUT_QUALITY = 0.85;             // JPEG quality

export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export class AvatarError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new AvatarError("read_failed", "Could not read file."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new AvatarError("decode_failed", "Could not decode image."));
    img.onload = () => resolve(img);
    img.src = src;
  });

// Validate + downscale to a square data URL. Throws AvatarError on bad input.
export async function processAvatarFile(file) {
  if (!file) throw new AvatarError("no_file", "No file selected.");
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new AvatarError("invalid_type", "Unsupported image type.");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new AvatarError("too_large", "Image is larger than 8 MB.");
  }

  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const side = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - side) / 2;
  const sy = (img.naturalHeight - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("canvas_failed", "Browser does not support canvas.");

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);

  return canvas.toDataURL("image/jpeg", OUTPUT_QUALITY);
}
