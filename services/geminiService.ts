import {
  GoogleGenAI,
  Modality,
  type GenerateContentResponse,
  type Part,
} from "@google/genai";
import {
  MASK_BLACK_UNCHANGED,
  MASK_EDGE_COMPLETION,
  MASK_NO_UNREQUESTED_EXTRAS,
  MASK_ROW_RETAIL_FACADES,
  MASK_SPATIAL_SCOPE,
} from "./presetRules";

/** Values supported by Gemini image `imageConfig.aspectRatio` (see @google/genai ImageConfig). */
export type GeminiImageAspectRatio =
  | "1:1"
  | "2:3"
  | "3:2"
  | "3:4"
  | "4:3"
  | "9:16"
  | "16:9"
  | "21:9";

const NO_CROP_IMAGE_HINT =
  "Preserve the full original field of view and aspect ratio: do not crop, zoom-reframe, or cut off buildings, trees, vehicles, people, or street objects at any edge. Any additions must be fully visible inside the frame.";

const NO_BLURRY_ARTIFACTS_HINT =
  "Do not add blur, glow, bloom, haze, or painterly softness to new elements or edges unless the original photo already has shallow depth-of-field there; keep additions crisp and photographically sharp.";

/** Brush / mask edits: match the rest of the frame so nothing looks pasted on. */
const WHOLE_SCENE_COHERENCE_MASK =
  "Make the edit belong to this single photograph: match the existing light direction and quality, white balance, contrast, saturation, and shadow softness of nearby pavement and buildings. Keep the same apparent sharpness and noise/grain level as the rest of the image. Add plausible contact shadows and ambient bounce consistent with surfaces around the change. Avoid a cut-out or composite look at boundaries — the result must read as one unified exposure.";

/** The mask is only where-to-edit metadata, not content to render. */
const MASK_IS_LOCATION_ONLY =
  "The mask image is not a layer, sticker, or tint to reproduce: it only marks 2D locations where changes belong. Do not paint the mask pattern, brush strokes, halos, or any overlay into the result — output a normal flat photograph as if the mask never existed.";

const getAiClient = () => {
  // Priority: 1. API_KEY (from selection dialog), 2. CUSTOM_GEMINI_API_KEY (from secrets), 3. GEMINI_API_KEY (default)
  const apiKey = process.env.API_KEY || process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key not found. Please ensure an API key is provided.");
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to call Gemini with exponential backoff for 429 errors
 */
const callWithRetry = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isQuotaError = error.message?.includes("429") || 
                          error.status === "RESOURCE_EXHAUSTED" ||
                          JSON.stringify(error).includes("429");
      
      if (isQuotaError && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 2000 + Math.random() * 1000;
        console.warn(`Quota exceeded (429). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
};

/**
 * Helper to ensure an image is in base64 format for the Gemini API.
 */
/** MIME + raw base64 (no data: prefix) for API inlineData */
const ensureBase64 = async (imageInput: string): Promise<{ mimeType: string; base64: string }> => {
  if (imageInput.startsWith('data:')) {
    const m = imageInput.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (m) {
      let mime = m[1].toLowerCase();
      if (mime === 'image/jpg') mime = 'image/jpeg';
      return { mimeType: mime, base64: m[2] };
    }
    const stripped = imageInput.replace(/^data:image\/[\w.+~-]+;base64,/i, '');
    return { mimeType: 'image/jpeg', base64: stripped };
  }

  try {
    const response = await fetch(imageInput);
    const blob = await response.blob();
    const mimeType = blob.type && blob.type.startsWith('image/')
      ? blob.type
      : 'image/jpeg';
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
        if (m) {
          resolve({ mimeType: m[1], base64: m[2] });
        } else {
          reject(new Error('Unexpected data URL format from blob'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert image to base64:", error);
    return { mimeType: 'image/jpeg', base64: imageInput };
  }
};

/** Correct MIME + raw base64 from a data URL (Gemini is sensitive to PNG vs JPEG). */
const mimeAndBase64FromDataUrl = (
  imageInput: string,
): { mimeType: string; base64: string } | null => {
  const m = imageInput.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) return null;
  let mime = m[1].toLowerCase();
  if (mime === "image/jpg") mime = "image/jpeg";
  return { mimeType: mime, base64: m[2] };
};

function extractInlineImageDataUrl(response: GenerateContentResponse): string {
  const feedback = response.promptFeedback;
  if (feedback?.blockReason) {
    const msg =
      typeof feedback.blockReasonMessage === 'string'
        ? feedback.blockReasonMessage
        : '';
    throw new Error(
      msg || `Prompt was blocked (${String(feedback.blockReason)}).`
    );
  }

  const candidates = response.candidates ?? [];
  const textPieces: string[] = [];

  for (const cand of candidates) {
    const fr = cand.finishReason;
    if (fr === 'SAFETY' || fr === 'BLOCKLIST' || fr === 'PROHIBITED_CONTENT') {
      throw new Error(
        `Transformation blocked (${fr}). Try a shorter or different prompt.`
      );
    }
    const parts = cand.content?.parts ?? [];
    for (const part of parts) {
      const id = part.inlineData;
      if (id?.data) {
        const mime = id.mimeType || 'image/png';
        return `data:${mime};base64,${id.data}`;
      }
      if (part.text?.trim()) {
        textPieces.push(part.text.trim());
      }
    }
  }

  const combined = textPieces.join('\n').trim();
  if (combined.length > 0) {
    throw new Error(
      `No image in the reply (model returned text only): ${combined.slice(0, 280)}`
    );
  }

  throw new Error('No image was returned from the transformation.');
}

/**
 * Uses Gemini 2.5 Flash to get grounded descriptive details about a location.
 */
export const getGroundedPrompt = async (prompt: string, highQuality = true): Promise<string> => {
  if (!highQuality) return prompt;

  return callWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: [{ text: `Search for current Google Street View images and visual details of "${prompt}" in Berlin. 
      Provide a highly detailed, photorealistic visual description for an AI image generator. 
      CRITICAL CONSTRAINTS:
      1. STYLE: Must look exactly like a Google Street View capture.
      2. PERSPECTIVE: Wide-angle lens (approx 14mm), captured from a height of 2.5 meters (typical car-top camera height).
      3. ATMOSPHERE: Clear daylight, neutral colors, realistic urban lighting.
      4. NO TEXT: Absolutely NO text, labels, watermarks, street signs names, or signatures in the description.
      Focus on architecture, street furniture, foliage, and atmosphere. 
      Output ONLY the description.` }] },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text || prompt;
  }).catch(error => {
    console.warn("Search grounding failed:", error);
    return prompt;
  });
};

/**
 * Generates a new image from scratch using the flash image model.
 */
export const generateImage = async (prompt: string, highQuality = true): Promise<string> => {
  // Get grounded details first (only if high quality)
  const detailedPrompt = await getGroundedPrompt(prompt, highQuality);

  return callWithRetry(async () => {
    const ai = getAiClient();
    const model = highQuality ? 'gemini-3.1-flash-image-preview' : 'gemini-2.5-flash-image';
    
    const config: Record<string, unknown> = {
      responseModalities: [Modality.IMAGE],
      imageConfig: {
        aspectRatio: "16:9",
        ...(highQuality ? { imageSize: '1K' as const } : {}),
      },
    };

    if (highQuality) {
      config.tools = [
        {
          googleSearch: {
            searchTypes: {
              webSearch: {},
              imageSearch: {},
            }
          },
        },
      ];
    }

    const response = await ai.models.generateContent({
      model,
      contents:
        `${detailedPrompt}. Style: Google Street View, wide-angle lens, 2.5m camera height, realistic urban lighting, clear daylight. ${NO_BLURRY_ARTIFACTS_HINT} CRITICAL: Do NOT add any text, labels, watermarks, or signatures to the image.`,
      config: config as never,
    });

    return extractInlineImageDataUrl(response);
  });
};

/**
 * Transforms an existing image, optionally using a mask for inpainting or a sketch for visual guidance.
 */
export const transformImage = async (
  imageBase64: string, 
  prompt: string, 
  maskBase64?: string | null,
  highQuality = true,
  aspectRatio: GeminiImageAspectRatio = "16:9"
): Promise<string> => {
  const [imagePrepared, maskPrepared] = await Promise.all([
    ensureBase64(imageBase64),
    maskBase64 ? ensureBase64(maskBase64) : Promise.resolve(null),
  ]);

  const refMeta = mimeAndBase64FromDataUrl(imageBase64);
  const refMime = refMeta?.mimeType ?? imagePrepared.mimeType;
  const maskMeta = maskBase64 ? mimeAndBase64FromDataUrl(maskBase64) : null;
  const maskMime = maskMeta?.mimeType ?? maskPrepared?.mimeType ?? "image/png";

  const userPrompt = prompt.replace(/"""+/g, '"').trim();

  let parts: Part[];

  if (maskPrepared) {
    // Text MUST come first so the model binds this request to the following images.
    parts = [
      {
        text: `PRIMARY EDIT REQUEST — apply exactly this change in this single generation (ignore any unrelated prior hypothetical edits):
"""${userPrompt}"""

The next two parts are images in order:
(1) REFERENCE PHOTO — full current scene to edit.
(2) LOCATION MAP — same pixel grid as (1). White = minimum region for your edit; black = leave the reference unchanged in parts of the scene clearly away from that edit. ${MASK_IS_LOCATION_ONLY} ${MASK_BLACK_UNCHANGED} ${MASK_EDGE_COMPLETION} ${MASK_NO_UNREQUESTED_EXTRAS} ${MASK_SPATIAL_SCOPE} ${MASK_ROW_RETAIL_FACADES} Do not add unrelated global atmosphere or “street dressing” far from the brushed zone.

Return ONE full-frame image: distant black-map areas match (1); the requested change appears centered on white with a modest completion band so poles, awnings, and furniture are not clipped at the stroke line. ${WHOLE_SCENE_COHERENCE_MASK} ${NO_CROP_IMAGE_HINT} ${NO_BLURRY_ARTIFACTS_HINT} No text or watermarks.`,
      },
      {
        inlineData: {
          mimeType: refMime,
          data: imagePrepared.base64,
        },
      },
      {
        inlineData: {
          mimeType: maskMime,
          data: maskPrepared.base64,
        },
      },
    ];
  } else {
    parts = [
      {
        inlineData: {
          mimeType: refMime,
          data: imagePrepared.base64,
        },
      },
      {
        text: `Transform this image based on: ${userPrompt}. 
      Maintain the original scene structure and especially the buildings. Do NOT change any architecture unless explicitly told to.
      Ground any new elements on the correct surface (paving, asphalt, plaza) with believable size and perspective relative to doors, windows, curbs, and vehicles.
      ${NO_CROP_IMAGE_HINT}
      ${NO_BLURRY_ARTIFACTS_HINT}
      CRITICAL: Do NOT add any text, labels, watermarks, or signatures to the image.`,
      },
    ];
  }

  return callWithRetry(async () => {
    const ai = getAiClient();
    // Masked edits used to always pick the preview model (`mask || highQuality`),
    // so turning "high quality" off still hit the slow path. Follow the HQ toggle only.
    const model = highQuality
      ? 'gemini-3.1-flash-image-preview'
      : 'gemini-2.5-flash-image';

    const imageConfig = {
      aspectRatio,
      ...(highQuality ? { imageSize: '1K' as const } : {}),
    };

    const response = await ai.models.generateContent({
      model,
      contents: { role: 'user', parts },
      config: {
        responseModalities: [Modality.IMAGE],
        ...(maskPrepared ? { temperature: 0.24 as const } : {}),
        imageConfig,
      },
    });

    return extractInlineImageDataUrl(response);
  });
};
