import type { AreaEditIntegrityReport } from '../types';
import { loadImage } from '../mask/loadImage';
import { INTEGRITY_TOLERANCE } from '../constants';

/**
 * Validates that pixels outside the *hard* mask (non-editable) did not drift after compositing.
 * Compositing should already preserve them; this catches pipeline bugs Model-only paths cannot fix.
 */
export async function verifyUnmaskedIntegrity(
  originalDataUrl: string,
  compositeDataUrl: string,
  canonicalHardMaskDataUrl: string,
  toleranceRgb = INTEGRITY_TOLERANCE
): Promise<AreaEditIntegrityReport> {
  const [origImg, cmpImg, mImg] = await Promise.all([
    loadImage(originalDataUrl),
    loadImage(compositeDataUrl),
    loadImage(canonicalHardMaskDataUrl),
  ]);

  const w = origImg.width;
  const h = origImg.height;
  const total = w * h;

  const c1 = document.createElement('canvas');
  c1.width = w;
  c1.height = h;
  const c2 = document.createElement('canvas');
  c2.width = w;
  c2.height = h;
  const cm = document.createElement('canvas');
  cm.width = w;
  cm.height = h;

  const g1 = c1.getContext('2d');
  const g2 = c2.getContext('2d');
  const gm = cm.getContext('2d');
  if (!g1 || !g2 || !gm) {
    return { passed: false, maxChannelDeltaOutsideMask: 255, violationRate: 1 };
  }

  g1.drawImage(origImg, 0, 0, w, h);
  g2.drawImage(cmpImg, 0, 0, w, h);
  gm.drawImage(mImg, 0, 0, w, h);

  const p1 = g1.getImageData(0, 0, w, h).data;
  const p2 = g2.getImageData(0, 0, w, h).data;
  const pm = gm.getImageData(0, 0, w, h).data;

  let violations = 0;
  let outsideCount = 0;
  let maxDelta = 0;

  for (let i = 0; i < p1.length; i += 4) {
    const mlum = (pm[i] + pm[i + 1] + pm[i + 2]) / 3;
    const outside = mlum <= 128;
    if (!outside) continue;
    outsideCount++;

    let dsum = 0;
    let localMax = 0;
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(p1[i + c] - p2[i + c]);
      dsum += d;
      if (d > localMax) localMax = d;
    }
    if (localMax > maxDelta) maxDelta = localMax;

    if (dsum > toleranceRgb * 3) violations++;
  }

  const violationRate = outsideCount > 0 ? violations / outsideCount : 0;
  const passed = violationRate < 1e-4 && maxDelta <= toleranceRgb + 1;

  return { passed, maxChannelDeltaOutsideMask: maxDelta, violationRate };
}
