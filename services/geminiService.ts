import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  // Priority: 1. API_KEY (from selection dialog), 2. CUSTOM_GEMINI_API_KEY (from secrets), 3. GEMINI_API_KEY (default)
  const apiKey =
    process.env.API_KEY ||
    process.env.CUSTOM_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API Key not found. Please ensure an API key is provided.",
    );
  }
  return new GoogleGenAI({ apiKey });
};

/**
 * Helper to call Gemini with exponential backoff for 429 errors
 */
const callWithRetry = async <T>(
  fn: () => Promise<T>,
  maxRetries = 3,
): Promise<T> => {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const isQuotaError =
        error.message?.includes("429") ||
        error.status === "RESOURCE_EXHAUSTED" ||
        JSON.stringify(error).includes("429");

      if (isQuotaError && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 2000 + Math.random() * 1000;
        console.warn(
          `Quota exceeded (429). Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
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
const ensureBase64 = async (imageInput: string): Promise<string> => {
  if (imageInput.startsWith("data:")) {
    return imageInput.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
  }

  // If it's a URL, fetch it and convert to base64
  try {
    const response = await fetch(imageInput);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert image to base64:", error);
    // Return original and hope it works (might still be a base64 string without prefix)
    return imageInput;
  }
};

/**
 * Uses Gemini 2.5 Flash to get grounded descriptive details about a location.
 */
export const getGroundedPrompt = async (
  prompt: string,
  highQuality = true,
): Promise<string> => {
  if (!highQuality) return prompt;

  return callWithRetry(async () => {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            text: `Search for current Google Street View images and visual details of "${prompt}" in Berlin. 
      Provide a highly detailed, photorealistic visual description for an AI image generator. 
      CRITICAL CONSTRAINTS:
      1. STYLE: Must look exactly like a Google Street View capture.
      2. PERSPECTIVE: Wide-angle lens (approx 14mm), captured from a height of 2.5 meters (typical car-top camera height).
      3. ATMOSPHERE: Clear daylight, neutral colors, realistic urban lighting.
      4. NO TEXT: Absolutely NO text, labels, watermarks, street signs names, or signatures in the description.
      Focus on architecture, street furniture, foliage, and atmosphere. 
      Output ONLY the description.`,
          },
        ],
      },
      config: {
        tools: [{ googleSearch: {} }],
      },
    });
    return response.text || prompt;
  }).catch((error) => {
    console.warn("Search grounding failed:", error);
    return prompt;
  });
};

/**
 * Generates a new image from scratch using the flash image model.
 */
export const generateImage = async (
  prompt: string,
  highQuality = true,
): Promise<string> => {
  // Get grounded details first (only if high quality)
  const detailedPrompt = await getGroundedPrompt(prompt, highQuality);

  return callWithRetry(async () => {
    const ai = getAiClient();
    const model = highQuality
      ? "gemini-3.1-flash-image-preview"
      : "gemini-2.5-flash-image";

    const config: any = {
      imageConfig: {
        aspectRatio: "16:9",
      },
    };

    if (highQuality) {
      config.imageConfig.imageSize = "1K";
      config.tools = [
        {
          googleSearch: {
            searchTypes: {
              webSearch: {},
              imageSearch: {},
            },
          },
        },
      ];
    }

    const response = await ai.models.generateContent({
      model,
      contents: {
        parts: [
          {
            text: `${detailedPrompt}. Style: Google Street View, wide-angle lens, 2.5m camera height, realistic urban lighting, clear daylight. CRITICAL: Do NOT add any text, labels, watermarks, or signatures to the image.`,
          },
        ],
      },
      config: {
        imageConfig: config.imageConfig,
        tools: config.tools,
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(
      (p) => p.inlineData,
    );
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    throw new Error("The model did not return an image.");
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
  aspectRatio: "1:1" | "3:4" | "4:3" | "9:16" | "16:9" = "16:9",
): Promise<string> => {
  const [cleanImage, cleanMask] = await Promise.all([
    ensureBase64(imageBase64),
    maskBase64 ? ensureBase64(maskBase64) : Promise.resolve(null),
  ]);

  const parts: any[] = [
    {
      inlineData: {
        mimeType: "image/png",
        data: cleanImage,
      },
    },
  ];

  if (cleanMask) {
    parts.push({
      inlineData: {
        mimeType: "image/png",
        data: cleanMask,
      },
    });
    parts.push({
      text: `INPAINTING TASK:
      Image 1 is the reference background.
      Image 2 is the selection mask (White = where to add content, Black = original area).
      
      Task: Seamlessly integrate "${prompt}" into Image 1 within the white mask area.
      
      Requirements:
      1. PERSPECTIVE: Align the object's 3D perspective with the street and buildings in Image 1.
      2. LIGHTING: Match the sun direction, color temperature, and shadows from Image 1 exactly. Shadows must be sharp if the original scene lighting is harsh.
      3. ZERO BACKGROUND OVERHEAD: The area inside the white mask that isn't the object must remain identical to the background of Image 1. Absolute pixel-level consistency for the surrounding pixels is required.
      4. CONTAINMENT: Every part of "${prompt}" must be contained within the white pixels.
      5. SHARP DEFINITION: Avoid any atmospheric blur or soft-glow at the edges. The object should look like a high-resolution, sharp photograph.
      6. NO TEXT: Absolutely no text, labels, or watermarks.
      
      Return the full modified Image 1.`,
    });
  } else {
    parts.push({
      text: `Transform this image based on: ${prompt}. 
      Maintain the original scene structure and especially the buildings. Do NOT change any architecture unless explicitly told to.
      CRITICAL: Do NOT add any text, labels, watermarks, or signatures to the image.`,
    });
  }

  return callWithRetry(async () => {
    const ai = getAiClient();
    // For mask-based inpainting, gemini-3.1-flash-image-preview is usually much better at following complex constraints
    const model =
      cleanMask || highQuality
        ? "gemini-3.1-flash-image-preview"
        : "gemini-2.5-flash-image";

    const response = await ai.models.generateContent({
      model,
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: highQuality ? "1K" : undefined,
        },
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts.find(
      (p) => p.inlineData,
    );
    if (imagePart?.inlineData?.data) {
      return `data:image/png;base64,${imagePart.inlineData.data}`;
    }
    throw new Error("No image was returned from the transformation.");
  });
};
