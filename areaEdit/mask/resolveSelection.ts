import type { AreaSelection } from '../types';
import { AreaEditError } from '../errors';
import { loadImage } from './loadImage';

function fillBlack(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
}

function binarizeMaskRegion(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const lum = (data[i] + data[i + 1] + data[i + 2]) / 3;
    if (lum > 10) {
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
    } else {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    }
    data[i + 3] = 255;
  }
  ctx.putImageData(imageData, 0, 0);
}

function compositeOrMax(
  accum: CanvasRenderingContext2D,
  layer: CanvasImageSource,
  w: number,
  h: number
) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const lx = c.getContext('2d');
  if (!lx) return;
  lx.drawImage(layer, 0, 0, w, h);
  const cur = accum.getImageData(0, 0, w, h);
  const next = lx.getImageData(0, 0, w, h);
  for (let i = 0; i < cur.data.length; i += 4) {
    cur.data[i] = Math.max(cur.data[i], next.data[i]);
    cur.data[i + 1] = Math.max(cur.data[i + 1], next.data[i + 1]);
    cur.data[i + 2] = Math.max(cur.data[i + 2], next.data[i + 2]);
    cur.data[i + 3] = 255;
  }
  accum.putImageData(cur, 0, 0);
}

/**
 * Produces canonical black/white mask PNG data URL sized exactly to scene dimensions.
 */
export async function resolveSelectionToMask(selection: AreaSelection, sceneW: number, sceneH: number): Promise<string> {
  if (selection.kind === 'union') {
    const canvas = document.createElement('canvas');
    canvas.width = sceneW;
    canvas.height = sceneH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    fillBlack(ctx, sceneW, sceneH);
    for (const r of selection.regions) {
      const subMask = await resolveSelectionToMask(r, sceneW, sceneH);
      const si = await loadImage(subMask);
      compositeOrMax(ctx, si, sceneW, sceneH);
    }
    return canvas.toDataURL('image/png');
  }

  if (selection.kind === 'bbox') {
    const canvas = document.createElement('canvas');
    canvas.width = sceneW;
    canvas.height = sceneH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unsupported');
    fillBlack(ctx, sceneW, sceneH);
    const { x, y, width, height } = selection.rect;
    const px = x * sceneW;
    const py = y * sceneH;
    const pw = width * sceneW;
    const ph = height * sceneH;
    ctx.fillStyle = '#fff';
    ctx.fillRect(px, py, pw, ph);
    return canvas.toDataURL('image/png');
  }

  // raster — must align 1:1 with scene to guarantee boundary semantics
  const img = await loadImage(selection.dataUrl);
  if (Math.abs(img.width - sceneW) > 2 || Math.abs(img.height - sceneH) > 2) {
    throw new AreaEditError(
      `Mask size ${img.width}×${img.height} does not match image ${sceneW}×${sceneH}.`,
      'MASK_GEOMETRY'
    );
  }
  const canvas = document.createElement('canvas');
  canvas.width = sceneW;
  canvas.height = sceneH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unsupported');
  fillBlack(ctx, sceneW, sceneH);
  ctx.drawImage(img, 0, 0, sceneW, sceneH);
  binarizeMaskRegion(ctx, sceneW, sceneH);
  return canvas.toDataURL('image/png');
}
