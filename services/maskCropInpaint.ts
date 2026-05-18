import { loadImageElement } from "./imageUtils";

export interface MaskBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Fraction of full image pixels inside the padded box. */
  areaFraction: number;
}

/** Padded bounding box of white mask pixels (image pixel coordinates). */
export async function extractMaskBoundingBox(
  maskDataUrl: string,
  imageWidth: number,
  imageHeight: number,
  paddingRatio = 0.08,
): Promise<MaskBBox | null> {
  const maskImg = await loadImageElement(maskDataUrl);
  const w = imageWidth;
  const h = imageHeight;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(maskImg, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  let count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (lum > 12) {
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (count < 48 || maxX < minX) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const padX = Math.round(bw * paddingRatio);
  const padY = Math.round(bh * paddingRatio);
  const x0 = Math.max(0, minX - padX);
  const y0 = Math.max(0, minY - padY);
  const x1 = Math.min(w - 1, maxX + padX);
  const y1 = Math.min(h - 1, maxY + padY);
  const boxArea = (x1 - x0 + 1) * (y1 - y0 + 1);

  return {
    x0,
    y0,
    x1,
    y1,
    areaFraction: boxArea / (w * h),
  };
}

export async function cropDataUrlToBBox(
  dataUrl: string,
  bbox: MaskBBox,
): Promise<string> {
  const img = await loadImageElement(dataUrl);
  const w = bbox.x1 - bbox.x0 + 1;
  const h = bbox.y1 - bbox.y0 + 1;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, bbox.x0, bbox.y0, w, h, 0, 0, w, h);
  return canvas.toDataURL("image/png");
}

/**
 * Place crop-sized model output at the mask bbox on top of the original (no feather).
 * runAreaEdit composites once with the brush mask for a sharp, aligned edge.
 */
export async function embedCropInFullFrame(
  sceneDataUrl: string,
  cropResultDataUrl: string,
  bbox: MaskBBox,
): Promise<string> {
  const scene = await loadImageElement(sceneDataUrl);
  const crop = await loadImageElement(cropResultDataUrl);
  const w = scene.naturalWidth;
  const h = scene.naturalHeight;
  const cw = bbox.x1 - bbox.x0 + 1;
  const ch = bbox.y1 - bbox.y0 + 1;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sceneDataUrl;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(scene, 0, 0);
  ctx.drawImage(crop, 0, 0, crop.naturalWidth, crop.naturalHeight, bbox.x0, bbox.y0, cw, ch);
  return canvas.toDataURL("image/png");
}

/** @deprecated Prefer embedCropInFullFrame + single composite pass in runAreaEdit */
export async function pasteCropResultOntoScene(
  sceneDataUrl: string,
  cropResultDataUrl: string,
  maskDataUrl: string,
  bbox: MaskBBox,
): Promise<string> {
  const scene = await loadImageElement(sceneDataUrl);
  const crop = await loadImageElement(cropResultDataUrl);
  const mask = await loadImageElement(maskDataUrl);
  const w = scene.naturalWidth;
  const h = scene.naturalHeight;
  const cw = bbox.x1 - bbox.x0 + 1;
  const ch = bbox.y1 - bbox.y0 + 1;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return sceneDataUrl;
  ctx.drawImage(scene, 0, 0);

  const patch = document.createElement("canvas");
  patch.width = w;
  patch.height = h;
  const pctx = patch.getContext("2d");
  if (!pctx) return sceneDataUrl;
  pctx.drawImage(crop, 0, 0, cw, ch, bbox.x0, bbox.y0, cw, ch);

  const matte = document.createElement("canvas");
  matte.width = w;
  matte.height = h;
  const mctx = matte.getContext("2d");
  if (!mctx) return sceneDataUrl;
  mctx.drawImage(mask, 0, 0, w, h);
  const md = mctx.getImageData(0, 0, w, h);
  const lo = 28;
  const hi = 110;
  for (let i = 0; i < md.data.length; i += 4) {
    const lum = (md.data[i] + md.data[i + 1] + md.data[i + 2]) / 3;
    const a =
      lum < lo ? 0 : lum > hi ? 255 : Math.round(((lum - lo) / (hi - lo)) * 255);
    md.data[i + 3] = a;
    md.data[i] = 255;
    md.data[i + 1] = 255;
    md.data[i + 2] = 255;
  }
  mctx.putImageData(md, 0, 0);

  pctx.globalCompositeOperation = "destination-in";
  pctx.drawImage(matte, 0, 0);
  pctx.globalCompositeOperation = "source-over";

  ctx.drawImage(patch, 0, 0);
  return canvas.toDataURL("image/png");
}
