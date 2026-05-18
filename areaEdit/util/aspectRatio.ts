import type { GeminiAspectRatio } from '../types';

export function inferGeminiAspectRatioFromImage(img: HTMLImageElement): GeminiAspectRatio {
  const { width: w, height: h } = img;
  if (!w || !h) return '16:9';
  const ratio = w / h;
  if (ratio > 1.5) return '16:9';
  if (ratio > 1.2) return '4:3';
  if (ratio > 0.8) return '1:1';
  if (ratio > 0.6) return '3:4';
  return '9:16';
}

export function inferGeminiAspectRatioFromDimensions(width: number, height: number): GeminiAspectRatio {
  if (!width || !height) return '16:9';
  const ratio = width / height;
  if (ratio > 1.5) return '16:9';
  if (ratio > 1.2) return '4:3';
  if (ratio > 0.8) return '1:1';
  if (ratio > 0.6) return '3:4';
  return '9:16';
}
