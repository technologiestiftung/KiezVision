import { DEFAULT_COMPOSITE } from "../constants";
import type { MaskCompositeOptions } from "../types";
import { loadImage } from "../mask/loadImage";

interface DrawImageExactFitOptions {
	ctx: CanvasRenderingContext2D;
	img: HTMLImageElement;
	dx: number;
	dy: number;
	dWidth: number;
	dHeight: number;
}

/** Stretch source to destination rect — preserves mask pixel alignment (no center crop). */
export function drawImageExactFit(options: DrawImageExactFitOptions) {
	const { ctx, img, dx, dy, dWidth, dHeight } = options;
	if (!img.width || !img.height) {
		ctx.drawImage(img, dx, dy, dWidth, dHeight);
		return;
	}
	ctx.drawImage(img, 0, 0, img.width, img.height, dx, dy, dWidth, dHeight);
}

function maskLumToAlpha(
	lum: number,
	lumLowCutoff: number,
	lumHighCutoff: number,
): number {
	if (lum < lumLowCutoff) return 0;
	if (lum > lumHighCutoff) return 255;
	return Math.round(
		((lum - lumLowCutoff) / (lumHighCutoff - lumLowCutoff)) * 255,
	);
}

interface BuildSoftAlphaMatteOptions {
	maskCanvas: HTMLCanvasElement;
	width: number;
	height: number;
	compositeOptions?: MaskCompositeOptions;
}

/**
 * Build soft alpha matte (white RGB, alpha ramp) suitable for GPU-style destination-in.
 */
export function buildSoftAlphaMatteFromMaskCanvas(
	options: BuildSoftAlphaMatteOptions,
): HTMLCanvasElement {
	const { maskCanvas, width, height, compositeOptions } = options;
	const lumLowCutoff =
		compositeOptions?.lumLowCutoff ?? DEFAULT_COMPOSITE.lumLowCutoff;
	const lumHighCutoff =
		compositeOptions?.lumHighCutoff ?? DEFAULT_COMPOSITE.lumHighCutoff;
	const clamp =
		compositeOptions?.featherPxClamp ?? DEFAULT_COMPOSITE.featherPxClamp;

	const maskStage = document.createElement("canvas");
	maskStage.width = width;
	maskStage.height = height;
	const mctx = maskStage.getContext("2d");
	if (!mctx) throw new Error("Canvas unsupported");
	mctx.drawImage(maskCanvas as CanvasImageSource, 0, 0, width, height);

	const maskImageData = mctx.getImageData(0, 0, width, height);
	const pixels = maskImageData.data;
	for (let i = 0; i < pixels.length; i += 4) {
		const lum = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
		const a = maskLumToAlpha(lum, lumLowCutoff, lumHighCutoff);
		pixels[i + 3] = a;
		pixels[i] = 255;
		pixels[i + 1] = 255;
		pixels[i + 2] = 255;
	}
	mctx.putImageData(maskImageData, 0, 0);

	const blurredMaskCanvas = document.createElement("canvas");
	blurredMaskCanvas.width = width;
	blurredMaskCanvas.height = height;
	const bmctx = blurredMaskCanvas.getContext("2d");
	if (!bmctx) throw new Error("Canvas unsupported");

	const edgeFeatherPx = Math.max(
		clamp.min,
		Math.min(clamp.max, Math.round(Math.min(width, height) / 200)),
	);
	if (edgeFeatherPx > 0) {
		bmctx.filter = `blur(${edgeFeatherPx}px)`;
		bmctx.drawImage(maskStage, 0, 0);
		bmctx.filter = "none";
	} else {
		bmctx.drawImage(maskStage, 0, 0);
	}

	return blurredMaskCanvas;
}

interface CompositePatchOptions {
	originalDataUrl: string;
	transformedDataUrl: string;
	canonicalMaskDataUrl: string;
	compositeOptions?: MaskCompositeOptions;
}

/** Alpha-composite transformed patch onto original using matte (hard guarantee unmasked survives). */
export async function compositePatchOverOriginal(
	options: CompositePatchOptions,
): Promise<string> {
	const {
		originalDataUrl,
		transformedDataUrl,
		canonicalMaskDataUrl,
		compositeOptions,
	} = options;
	const original = await loadImage(originalDataUrl);
	const transformed = await loadImage(transformedDataUrl);
	const maskBW = await loadImage(canonicalMaskDataUrl);

	const w = original.width;
	const h = original.height;

	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Canvas unsupported");
	ctx.drawImage(original, 0, 0);

	const maskCanvas = document.createElement("canvas");
	maskCanvas.width = w;
	maskCanvas.height = h;
	const mx = maskCanvas.getContext("2d");
	if (!mx) throw new Error("Canvas unsupported");
	mx.drawImage(maskBW, 0, 0, w, h);

	const alphaMatteCanvas = buildSoftAlphaMatteFromMaskCanvas({
		maskCanvas,
		width: w,
		height: h,
		compositeOptions,
	});

	const patchCanvas = document.createElement("canvas");
	patchCanvas.width = w;
	patchCanvas.height = h;
	const px = patchCanvas.getContext("2d");
	if (!px) throw new Error("Canvas unsupported");

	drawImageExactFit({
		ctx: px,
		img: transformed,
		dx: 0,
		dy: 0,
		dWidth: w,
		dHeight: h,
	});
	px.globalCompositeOperation = "destination-in";
	px.drawImage(alphaMatteCanvas, 0, 0);
	px.globalCompositeOperation = "source-over";

	ctx.drawImage(patchCanvas, 0, 0);
	return canvas.toDataURL("image/png");
}
