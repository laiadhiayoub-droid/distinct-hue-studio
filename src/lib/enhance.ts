/**
 * Browser-side scan enhancement before OCR:
 * EXIF/manual rotation → auto-deskew → shadow / uneven-light removal →
 * contrast stretch → sharpening. Returns a high-contrast grayscale JPEG.
 */

const MAX_SIDE = 2200;

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function ctx2d(c: HTMLCanvasElement) {
  return c.getContext("2d", { willReadFrequently: true })!;
}

function rotated(src: CanvasImageSource, w: number, h: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const out = canvas(w * cos + h * sin, w * sin + h * cos);
  const g = ctx2d(out);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, out.width, out.height);
  g.translate(out.width / 2, out.height / 2);
  g.rotate(rad);
  g.drawImage(src, -w / 2, -h / 2, w, h);
  return out;
}

/** Projection-profile skew estimate in degrees, searched in ±12°. */
function estimateSkew(src: HTMLCanvasElement): number {
  const scale = Math.min(1, 700 / Math.max(src.width, src.height));
  const small = canvas(src.width * scale, src.height * scale);
  const g = ctx2d(small);
  g.drawImage(src, 0, 0, small.width, small.height);
  const { data, width, height } = g.getImageData(0, 0, small.width, small.height);

  let sum = 0;
  const lum = new Float32Array(width * height);
  for (let i = 0; i < lum.length; i++) {
    const v = 0.299 * data[i * 4]! + 0.587 * data[i * 4 + 1]! + 0.114 * data[i * 4 + 2]!;
    lum[i] = v;
    sum += v;
  }
  const thr = (sum / lum.length) * 0.72;
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if (lum[y * width + x]! < thr) {
        xs.push(x - width / 2);
        ys.push(y - height / 2);
      }
  if (xs.length < 200) return 0;

  const diag = Math.ceil(Math.hypot(width, height));
  let best = 0;
  let bestScore = -1;
  for (let a = -12; a <= 12; a += 0.5) {
    const r = (a * Math.PI) / 180;
    const s = Math.sin(r);
    const c = Math.cos(r);
    const bins = new Float32Array(diag * 2);
    for (let i = 0; i < xs.length; i++) {
      const yy = Math.round(-xs[i]! * s + ys[i]! * c) + diag;
      bins[yy]! += 1;
    }
    let score = 0;
    for (let i = 1; i < bins.length; i++) {
      const d = bins[i]! - bins[i - 1]!;
      score += d * d;
    }
    if (score > bestScore) {
      bestScore = score;
      best = a;
    }
  }
  return best;
}

export async function enhanceScan(file: File, manualRotation = 0): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  let work = rotated(bmp, bmp.width * s, bmp.height * s, manualRotation);
  bmp.close?.();

  const skew = estimateSkew(work);
  if (Math.abs(skew) >= 0.5) work = rotated(work, work.width, work.height, -skew);

  const W = work.width;
  const H = work.height;
  const g = ctx2d(work);
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;

  // Background (lighting) estimate: heavy blur on a downscaled copy.
  const bgSmall = canvas(W / 8, H / 8);
  const bg = ctx2d(bgSmall);
  bg.filter = "blur(6px)";
  bg.drawImage(work, 0, 0, bgSmall.width, bgSmall.height);
  const bgFull = canvas(W, H);
  const bf = ctx2d(bgFull);
  bf.imageSmoothingQuality = "high";
  bf.drawImage(bgSmall, 0, 0, W, H);
  const bgd = bf.getImageData(0, 0, W, H).data;

  // Divide by background → flat paper; build histogram.
  const L = new Float32Array(W * H);
  const hist = new Uint32Array(256);
  for (let i = 0; i < L.length; i++) {
    const p = i * 4;
    const v = 0.299 * d[p]! + 0.587 * d[p + 1]! + 0.114 * d[p + 2]!;
    const b = Math.max(1, 0.299 * bgd[p]! + 0.587 * bgd[p + 1]! + 0.114 * bgd[p + 2]!);
    const n = Math.min(255, (v / b) * 255);
    L[i] = n;
    hist[n | 0]! += 1;
  }

  // Percentile contrast stretch (0.5% – 98%), slight gamma to boost faint ink.
  const lowT = L.length * 0.005;
  const highT = L.length * 0.98;
  let acc = 0;
  let lo = 0;
  let hi = 255;
  for (let i = 0; i < 256; i++) {
    acc += hist[i]!;
    if (acc <= lowT) lo = i;
    if (acc <= highT) hi = i;
  }
  if (hi - lo < 20) hi = Math.min(255, lo + 20);
  for (let i = 0; i < L.length; i++) {
    const t = Math.min(1, Math.max(0, (L[i]! - lo) / (hi - lo)));
    L[i] = Math.pow(t, 1.35) * 255;
  }

  // Unsharp mask (3×3) to recover blurred strokes.
  const out = new Float32Array(L.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) {
        out[i] = L[i]!;
        continue;
      }
      const blur =
        (L[i - W - 1]! + L[i - W]! + L[i - W + 1]! + L[i - 1]! + L[i]! + L[i + 1]! +
          L[i + W - 1]! + L[i + W]! + L[i + W + 1]!) / 9;
      out[i] = L[i]! + 1.2 * (L[i]! - blur);
    }
  for (let i = 0; i < out.length; i++) {
    const v = Math.min(255, Math.max(0, out[i]!));
    const p = i * 4;
    d[p] = d[p + 1] = d[p + 2] = v;
    d[p + 3] = 255;
  }
  g.putImageData(img, 0, 0);

  return new Promise((res, rej) =>
    work.toBlob((b) => (b ? res(b) : rej(new Error("Enhancement failed"))), "image/jpeg", 0.92),
  );
}

/** Rotated + resized colour copy (keeps diagrams/colours for the AI). */
export async function normalizeOriginal(file: File, manualRotation = 0): Promise<Blob> {
  const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
  const s = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const c = rotated(bmp, bmp.width * s, bmp.height * s, manualRotation);
  bmp.close?.();
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("Image read failed"))), "image/jpeg", 0.9),
  );
}
