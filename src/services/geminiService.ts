import {
	GoogleGenAI,
	Modality,
	type GenerateContentResponse,
	type Part,
} from "@google/genai";
import { MASK_EDGE_COMPLETION, presetAllowsNewObjects } from "./presetRules";
import { buildAreaEditInstruction } from "../areaEdit/prompts/buildOperationPrompt";
import {
	enrichAreaEditPrompt,
	inferAreaEditOperation,
} from "../areaEdit/prompts/enrichUserPrompt";
import {
	cropDataUrlToBBox,
	embedCropInFullFrame,
	extractMaskBoundingBox,
} from "./maskCropInpaint";
import { getGeminiApiKey } from "../lib/env.ts";
import { loadImageElement, resizeDataUrlToDimensions } from "./imageUtils";

/** Values supported by Gemini image `imageConfig.aspectRatio` (see @google/genai ImageConfig). */
export type GeminiImageAspectRatio =
	"1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "9:16" | "16:9" | "21:9";

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
	const apiKey = getGeminiApiKey();
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
	let lastError: unknown;
	for (let i = 0; i < maxRetries; i++) {
		try {
			return await fn();
		} catch (error: unknown) {
			lastError = error;
			const message = error instanceof Error ? error.message : String(error);
			const status =
				typeof error === "object" &&
				error !== null &&
				"status" in error &&
				typeof error.status === "string"
					? error.status
					: "";
			const isQuotaError =
				message.includes("429") ||
				status === "RESOURCE_EXHAUSTED" ||
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
/** MIME + raw base64 (no data: prefix) for API inlineData */
const ensureBase64 = async (
	imageInput: string,
): Promise<{ mimeType: string; base64: string }> => {
	if (imageInput.startsWith("data:")) {
		const m = imageInput.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
		if (m) {
			let mime = m[1].toLowerCase();
			if (mime === "image/jpg") mime = "image/jpeg";
			return { mimeType: mime, base64: m[2] };
		}
		const stripped = imageInput.replace(/^data:image\/[\w.+~-]+;base64,/i, "");
		return { mimeType: "image/jpeg", base64: stripped };
	}

	try {
		const response = await fetch(imageInput);
		const blob = await response.blob();
		return await new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onloadend = () => {
				const dataUrl = reader.result as string;
				const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
				if (m) {
					resolve({ mimeType: m[1], base64: m[2] });
				} else {
					reject(new Error("Unexpected data URL format from blob"));
				}
			};
			reader.onerror = reject;
			reader.readAsDataURL(blob);
		});
	} catch (error) {
		console.error("Failed to convert image to base64:", error);
		return { mimeType: "image/jpeg", base64: imageInput };
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

/** Inpainting: keep API inputs moderate — large photos + preview models often fail (IMAGE_OTHER). */
const MAX_MASK_INPUT_DIMENSION_FOR_API = 1280;

/** Downscale reference + mask together so registration is preserved. */
async function scaleRefAndMaskForImageModel(
	refDataUrl: string,
	maskDataUrl: string | null | undefined,
	maxDim: number,
): Promise<{ ref: string; mask: string | null }> {
	if (typeof document === "undefined") {
		return { ref: refDataUrl, mask: maskDataUrl ?? null };
	}
	try {
		const refImg = await loadImageElement(refDataUrl);
		const w = refImg.naturalWidth;
		const h = refImg.naturalHeight;
		if (!w || !h) return { ref: refDataUrl, mask: maskDataUrl ?? null };
		const scale = Math.min(1, maxDim / Math.max(w, h));
		if (scale >= 1) return { ref: refDataUrl, mask: maskDataUrl ?? null };

		const nw = Math.max(1, Math.round(w * scale));
		const nh = Math.max(1, Math.round(h * scale));
		const canvas = document.createElement("canvas");
		canvas.width = nw;
		canvas.height = nh;
		const ctx = canvas.getContext("2d");
		if (!ctx) return { ref: refDataUrl, mask: maskDataUrl ?? null };
		ctx.imageSmoothingEnabled = true;
		ctx.imageSmoothingQuality = "high";
		ctx.drawImage(refImg, 0, 0, nw, nh);
		const scaledRef = canvas.toDataURL("image/png");

		let scaledMask: string | null = maskDataUrl ?? null;
		if (scaledMask) {
			const mImg = await loadImageElement(scaledMask);
			const mc = document.createElement("canvas");
			mc.width = nw;
			mc.height = nh;
			const mctx = mc.getContext("2d");
			if (mctx) {
				mctx.drawImage(mImg, 0, 0, nw, nh);
				scaledMask = mc.toDataURL("image/png");
			}
		}
		return { ref: scaledRef, mask: scaledMask };
	} catch {
		return { ref: refDataUrl, mask: maskDataUrl ?? null };
	}
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
	let binary = "";
	const chunk = 8192;
	for (let i = 0; i < bytes.length; i += chunk) {
		const slice = bytes.subarray(i, i + chunk);
		binary += String.fromCharCode.apply(null, slice as unknown as number[]);
	}
	return btoa(binary);
}

function normalizeInlineDataPayload(
	part: Part,
): { mime: string; base64: string } | null {
	const id = part.inlineData;
	if (!id?.data) return null;
	const mime = id.mimeType || "image/png";
	const raw = id.data as string | Uint8Array;
	if (typeof raw === "string") return { mime, base64: raw };
	if (raw instanceof Uint8Array)
		return { mime, base64: uint8ArrayToBase64(raw) };
	return null;
}

function firstImageMimeFromResponse(response: GenerateContentResponse): string {
	for (const cand of response.candidates ?? []) {
		for (const part of cand.content?.parts ?? []) {
			if (part.inlineData?.mimeType) return part.inlineData.mimeType;
		}
	}
	return "image/png";
}

function throwIfPromptBlocked(response: GenerateContentResponse): void {
	const feedback = response.promptFeedback;
	if (!feedback?.blockReason) return;
	const msg =
		typeof feedback.blockReasonMessage === "string"
			? feedback.blockReasonMessage
			: "";
	throw new Error(
		msg || `Prompt was blocked (${String(feedback.blockReason)}).`,
	);
}

function tryExtractSdkImageDataUrl(
	response: GenerateContentResponse,
): string | null {
	const sdkImageB64 = response.data;
	if (typeof sdkImageB64 !== "string" || sdkImageB64.length === 0) {
		return null;
	}
	const mime = firstImageMimeFromResponse(response);
	return `data:${mime};base64,${sdkImageB64}`;
}

function extractImageFromCandidates(response: GenerateContentResponse): string {
	const textPieces: string[] = [];
	const finishReasons: string[] = [];

	for (const cand of response.candidates ?? []) {
		if (cand.finishReason) finishReasons.push(String(cand.finishReason));
		const fr = cand.finishReason;
		if (fr === "SAFETY" || fr === "BLOCKLIST" || fr === "PROHIBITED_CONTENT") {
			throw new Error(
				`Transformation blocked (${fr}). Try a shorter or different prompt.`,
			);
		}
		const parts = cand.content?.parts ?? [];
		for (const part of parts) {
			if (part.thought === true) continue;
			const normalized = normalizeInlineDataPayload(part);
			if (normalized) {
				return `data:${normalized.mime};base64,${normalized.base64}`;
			}
			if (part.text?.trim()) textPieces.push(part.text.trim());
		}
	}

	const combined = textPieces.join("\n").trim();
	if (combined.length > 0) {
		throw new Error(
			`No image in the reply (model returned text only): ${combined.slice(0, 280)}`,
		);
	}

	const hint =
		finishReasons.length > 0
			? ` finishReason: ${finishReasons.join(", ")}.`
			: "";
	throw new Error(
		`No image was returned from the transformation.${hint} For area edits, use a smaller brush region or try again.`,
	);
}

function extractInlineImageDataUrl(response: GenerateContentResponse): string {
	throwIfPromptBlocked(response);

	const sdkImage = tryExtractSdkImageDataUrl(response);
	if (sdkImage) return sdkImage;

	const candidates = response.candidates ?? [];
	if (candidates.length === 0) {
		throw new Error(
			"No image was returned from the transformation (empty response — check API key or try again).",
		);
	}

	return extractImageFromCandidates(response);
}

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

		const config: Record<string, unknown> = {
			responseModalities: [Modality.IMAGE],
			imageConfig: {
				aspectRatio: "16:9",
				...(highQuality ? { imageSize: "1K" as const } : {}),
			},
		};

		if (highQuality) {
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
			contents: `${detailedPrompt}. Style: Google Street View, wide-angle lens, 2.5m camera height, realistic urban lighting, clear daylight. ${NO_BLURRY_ARTIFACTS_HINT} CRITICAL: Do NOT add any text, labels, watermarks, or signatures to the image.`,
			config: config as never,
		});

		return extractInlineImageDataUrl(response);
	});
};

/**
 * Multimodal parts for inpainting: text + ref + mask (rules aligned with presetRules mask mode).
 */
function buildMaskEditParts(options: {
	instructionText: string;
	refMime: string;
	maskMime: string;
	refB64: string;
	maskB64: string;
}): Part[] {
	const { instructionText, refMime, maskMime, refB64, maskB64 } = options;
	return [
		{
			text: `${instructionText}

CRITICAL: The visible edit MUST appear inside every white pixel of image 2 — not only at the edges of the frame. Black mask areas must match image 1. ${MASK_IS_LOCATION_ONLY} ${MASK_EDGE_COMPLETION} ${WHOLE_SCENE_COHERENCE_MASK} ${NO_BLURRY_ARTIFACTS_HINT} No text or watermarks.`,
		},
		{
			inlineData: {
				mimeType: refMime,
				data: refB64,
			},
		},
		{
			inlineData: {
				mimeType: maskMime,
				data: maskB64,
			},
		},
	];
}

/** Image models that support generateContent + IMAGE modality (v1beta). */
const MASK_AREA_MODELS = [
	"gemini-2.5-flash-image",
	"gemini-3.1-flash-image-preview",
];

async function generateMaskedFrame(options: {
	ai: GoogleGenAI;
	imageBase64: string;
	maskBase64: string;
	instruction: string;
	maxDim: number;
	temperatures: number[];
}): Promise<string> {
	const { ai, imageBase64, maskBase64, instruction, maxDim, temperatures } =
		options;
	const scaled = await scaleRefAndMaskForImageModel(
		imageBase64,
		maskBase64,
		maxDim,
	);
	const refImg = await loadImageElement(scaled.ref);

	const [imagePrepared, maskPrepared] = await Promise.all([
		ensureBase64(scaled.ref),
		scaled.mask ? ensureBase64(scaled.mask) : Promise.resolve(null),
	]);
	if (!maskPrepared) {
		throw new Error("Mask could not be prepared for area edit.");
	}
	const refMeta = mimeAndBase64FromDataUrl(scaled.ref);
	const refMime = refMeta?.mimeType ?? imagePrepared.mimeType;
	const maskMeta = scaled.mask ? mimeAndBase64FromDataUrl(scaled.mask) : null;
	const maskMime = maskMeta?.mimeType ?? maskPrepared.mimeType ?? "image/png";

	const parts = buildMaskEditParts({
		instructionText: instruction,
		refMime,
		maskMime,
		refB64: imagePrepared.base64,
		maskB64: maskPrepared.base64,
	});

	let lastError = new Error("Area transform failed");
	let attempt = 0;
	const maxAttempts =
		MASK_AREA_MODELS.length * Math.max(temperatures.length, 1);

	for (const model of MASK_AREA_MODELS) {
		for (const temp of temperatures) {
			attempt++;
			try {
				const response = await ai.models.generateContent({
					model,
					contents: [{ role: "user", parts }],
					config: {
						responseModalities: [Modality.IMAGE],
						temperature: temp,
					},
				});
				const raw = extractInlineImageDataUrl(response);
				return resizeDataUrlToDimensions(
					raw,
					refImg.naturalWidth,
					refImg.naturalHeight,
				);
			} catch (e) {
				lastError = e instanceof Error ? e : new Error(String(e));
				const msg = lastError.message;
				if (msg.includes("NOT_FOUND") || msg.includes("404")) {
					console.warn(
						`[transformImage] model unavailable, skipping: ${model}`,
					);
					break;
				}
				if (attempt >= maxAttempts) throw lastError;
				console.warn(
					`[transformImage] area edit ${attempt}/${maxAttempts} (${model}, maxDim=${maxDim}, temp=${temp}):`,
					msg.slice(0, 140),
				);
				await new Promise((r) => setTimeout(r, 500));
			}
		}
	}
	throw lastError;
}

/**
 * Crop around the brush so the mask covers more of the frame, then paste the result back.
 */
async function runMaskedInpaintGeneration(
	imageBase64: string,
	maskBase64: string,
	instruction: string,
): Promise<string> {
	const ai = getAiClient();
	const fullRef = await loadImageElement(imageBase64);
	const fw = fullRef.naturalWidth;
	const fh = fullRef.naturalHeight;

	const bbox = await extractMaskBoundingBox({
		maskDataUrl: maskBase64,
		imageWidth: fw,
		imageHeight: fh,
	});
	const useCrop = bbox !== null && bbox.areaFraction < 0.82;

	const plans: { maxDim: number; temperatures: number[] }[] = [
		{ maxDim: MAX_MASK_INPUT_DIMENSION_FOR_API, temperatures: [0.35, 0.5] },
		{ maxDim: 768, temperatures: [0.4, 0.55] },
	];

	let lastError = new Error("Area transform failed");

	for (const plan of plans) {
		try {
			if (useCrop && bbox) {
				const cropRef = await cropDataUrlToBBox(imageBase64, bbox);
				const cropMask = await cropDataUrlToBBox(maskBase64, bbox);
				const cropInstruction = `${instruction}

Tight crop around the edit zone. Keep the new content anchored to the same ground position and scale as in the reference crop — do not shift or float the subject. White mask pixels must show a sharp, visible version of the requested change (not a copy of the reference). Match reference sharpness and grain.`;
				const cropOut = await generateMaskedFrame({
					ai,
					imageBase64: cropRef,
					maskBase64: cropMask,
					instruction: cropInstruction,
					maxDim: plan.maxDim,
					temperatures: plan.temperatures,
				});
				const cropW = bbox.x1 - bbox.x0 + 1;
				const cropH = bbox.y1 - bbox.y0 + 1;
				const cropFit = await resizeDataUrlToDimensions(cropOut, cropW, cropH);
				return embedCropInFullFrame(imageBase64, cropFit, bbox);
			}

			const fullOut = await generateMaskedFrame({
				ai,
				imageBase64,
				maskBase64,
				instruction,
				maxDim: plan.maxDim,
				temperatures: plan.temperatures,
			});
			return resizeDataUrlToDimensions(fullOut, fw, fh);
		} catch (e) {
			lastError = e instanceof Error ? e : new Error(String(e));
			console.warn(
				"[runMaskedInpaintGeneration] plan failed:",
				lastError.message.slice(0, 160),
			);
		}
	}

	throw lastError;
}

function buildMaskInstructionFromPrompt(userPrompt: string): string {
	if (
		userPrompt.includes("LOCAL INPAINTING") ||
		userPrompt.includes("WHITE/LIGHT")
	) {
		return userPrompt;
	}
	return buildAreaEditInstruction(
		enrichAreaEditPrompt(userPrompt),
		inferAreaEditOperation(userPrompt),
	);
}

/**
 * Transforms an existing image, optionally using a mask for inpainting or a sketch for visual guidance.
 */
export interface TransformImageOptions {
	imageBase64: string;
	prompt: string;
	maskBase64?: string | null;
	highQuality?: boolean;
	aspectRatio?: GeminiImageAspectRatio;
}

export async function transformImage(
	options: TransformImageOptions,
): Promise<string> {
	const {
		imageBase64,
		prompt,
		maskBase64,
		highQuality = true,
		aspectRatio = "16:9",
	} = options;
	const userPrompt = prompt.replace(/"""+/g, '"').trim();

	if (maskBase64) {
		const instruction = buildMaskInstructionFromPrompt(userPrompt);

		return callWithRetry(() =>
			runMaskedInpaintGeneration(imageBase64, maskBase64, instruction),
		);
	}

	const imagePrepared = await ensureBase64(imageBase64);

	const refMeta = mimeAndBase64FromDataUrl(imageBase64);
	const refMime = refMeta?.mimeType ?? imagePrepared.mimeType;

	const placementHint = presetAllowsNewObjects(userPrompt)
		? "Ground any new elements on the correct surface (paving, asphalt, plaza) with believable size and perspective relative to doors, windows, curbs, and vehicles. Bicycle racks belong on the sidewalk edge beside the curb; benches stay set back from the curb; never overlap racks and benches."
		: "Do not add, remove, or relocate physical objects except exactly as instructed. Change only lighting, sky, weather, or the specific removal described — no trees, benches, bike racks, water, or street dressing.";

	const parts: Part[] = [
		{
			inlineData: {
				mimeType: refMime,
				data: imagePrepared.base64,
			},
		},
		{
			text: `Transform this image based on: ${userPrompt}. 
      Maintain the original scene structure and especially the buildings. Do NOT change any architecture unless explicitly told to.
      ${placementHint}
      ${NO_CROP_IMAGE_HINT}
      ${NO_BLURRY_ARTIFACTS_HINT}
      CRITICAL: Do NOT add any text, labels, watermarks, or signatures to the image.`,
		},
	];

	return callWithRetry(async () => {
		const ai = getAiClient();

		type ImageAttempt = { model: string; imageSize?: "1K" };
		const attempts: ImageAttempt[] = highQuality
			? [
					{ model: "gemini-3.1-flash-image-preview", imageSize: "1K" },
					{ model: "gemini-3.1-flash-image-preview" },
					{ model: "gemini-2.5-flash-image" },
				]
			: [{ model: "gemini-2.5-flash-image" }];

		let lastError = new Error("Transform failed");

		for (let i = 0; i < attempts.length; i++) {
			const att = attempts[i];
			if (!att) continue;
			try {
				const response = await ai.models.generateContent({
					model: att.model,
					contents: [{ role: "user", parts }],
					config: {
						responseModalities: [Modality.IMAGE],
						imageConfig: {
							aspectRatio,
							...(att.imageSize ? { imageSize: att.imageSize } : {}),
						},
					},
				});
				return extractInlineImageDataUrl(response);
			} catch (e) {
				lastError = e instanceof Error ? e : new Error(String(e));
				const msg = lastError.message;
				const isLast = i === attempts.length - 1;
				const retriable =
					msg.includes("IMAGE_OTHER") ||
					(msg.includes("No image was returned") && !msg.includes("text only"));
				if (isLast || !retriable) throw lastError;
				console.warn(
					`[transformImage] ${att.model}${att.imageSize ? ` ${att.imageSize}` : ""} failed; retrying…`,
					msg.slice(0, 140),
				);
			}
		}

		throw lastError;
	});
}

/** Used by areaEdit pipeline — wraps transformImage with mask. */
export async function generateMaskedInpaintImage(opts: {
	imageDataUrl: string;
	maskDataUrl: string;
	instructionText: string;
	aspectRatio?: GeminiImageAspectRatio;
	highQuality?: boolean;
	seed?: number;
	temperature?: number;
}): Promise<string> {
	void opts.aspectRatio;
	void opts.highQuality;
	void opts.seed;
	void opts.temperature;
	const instruction = buildMaskInstructionFromPrompt(opts.instructionText);
	return runMaskedInpaintGeneration(
		opts.imageDataUrl,
		opts.maskDataUrl,
		instruction,
	);
}
