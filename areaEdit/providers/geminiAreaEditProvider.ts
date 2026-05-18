import type { AreaEditModelProvider } from '../types';
import { generateMaskedInpaintImage } from '../../services/geminiService';

export function createGeminiAreaEditProvider(): AreaEditModelProvider {
  return {
    async generateInpaintPatch(input) {
      return generateMaskedInpaintImage({
        imageDataUrl: input.imageDataUrl,
        maskDataUrl: input.maskDataUrl,
        instructionText: input.instructionText,
        aspectRatio: input.aspectRatio,
        highQuality: input.highQuality,
        seed: input.seed,
        temperature: input.temperature,
      });
    },
  };
}
