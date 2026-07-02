import type {
	AreaEditCache,
	AreaEditModelProvider,
	AreaEditRequest,
	AreaEditResult,
	GeminiAspectRatio,
} from "../types";
import { AreaEditError } from "../errors";
import {
	validateMaskCoverage,
	validatePrompt,
	assertSupportedOperation,
} from "../validation/validateAreaEditInput";
import { resolveSelectionToMask } from "../mask/resolveSelection";
import { loadImage } from "../mask/loadImage";
import { measureMaskCoverage } from "../mask/analyzeCoverage";
import { inferGeminiAspectRatioFromImage } from "../util/aspectRatio";
import { buildAreaEditCacheKey, djb2Hash } from "../util/hashKey";
import { buildAreaEditInstruction } from "../prompts/buildOperationPrompt";
import {
	enrichAreaEditPrompt,
	inferAreaEditOperation,
} from "../prompts/enrichUserPrompt";
import { compositePatchOverOriginal } from "../composite/compositePatch";
import { verifyUnmaskedIntegrity } from "../postprocess/verifyMaskBoundary";
import { createGeminiAreaEditProvider } from "../providers/geminiAreaEditProvider";

function weakBlobFingerprint(dataUrl: string): string {
	const head = dataUrl.slice(0, 480);
	const tail = dataUrl.slice(-480);
	return `${dataUrl.length}:${djb2Hash(head + tail)}`;
}

export interface RunAreaEditContext extends AreaEditRequest {
	/** Override default Gemini provider (tests / future backends). */
	provider?: AreaEditModelProvider;
	cache?: AreaEditCache;
}

async function resolveCanonicalMask(
	ctx: RunAreaEditContext,
	sceneW: number,
	sceneH: number,
): Promise<string> {
	try {
		return await resolveSelectionToMask(ctx.selection, sceneW, sceneH);
	} catch (e) {
		if (e instanceof AreaEditError) throw e;
		throw new AreaEditError(
			String((e as Error)?.message ?? e),
			"MASK_GEOMETRY",
			e,
		);
	}
}

async function readCacheHit(
	cache: AreaEditCache,
	cacheKey: string,
): Promise<string | undefined> {
	return Promise.resolve(cache.get(cacheKey));
}

async function tryReturnCachedResult(options: {
	cache: AreaEditCache | undefined;
	cacheKey: string | false | undefined;
	t0: number;
	op: AreaEditResult["meta"]["operation"];
	seed: number | undefined;
	timingsMs: AreaEditResult["meta"]["timingsMs"];
}): Promise<AreaEditResult | null> {
	const { cache, cacheKey, t0, op, seed, timingsMs } = options;
	if (!cache || !cacheKey) return null;
	const hit = await readCacheHit(cache, cacheKey);
	if (!hit) return null;
	timingsMs.total = Math.round(performance.now() - t0);
	return {
		dataUrl: hit,
		meta: { cacheHit: true, operation: op, seed, timingsMs },
	};
}

async function generateRawPatch(options: {
	provider: AreaEditModelProvider;
	ctx: RunAreaEditContext;
	canonicalMask: string;
	instructionText: string;
	aspectRatio: GeminiAspectRatio;
	highQuality: boolean;
}): Promise<string> {
	const {
		provider,
		ctx,
		canonicalMask,
		instructionText,
		aspectRatio,
		highQuality,
	} = options;
	try {
		return await provider.generateInpaintPatch({
			imageDataUrl: ctx.originalImageUrl,
			maskDataUrl: canonicalMask,
			instructionText,
			aspectRatio,
			highQuality,
			seed: ctx.options?.seed,
			temperature: ctx.options?.modelTemperature,
		});
	} catch (e) {
		throw new AreaEditError(
			(e as Error)?.message ?? "Generation failed",
			"UPSTREAM",
			e,
		);
	}
}

async function compositeGeneratedPatch(options: {
	ctx: RunAreaEditContext;
	rawPatch: string;
	canonicalMask: string;
}): Promise<string> {
	const { ctx, rawPatch, canonicalMask } = options;
	try {
		return await compositePatchOverOriginal({
			originalDataUrl: ctx.originalImageUrl,
			transformedDataUrl: rawPatch,
			canonicalMaskDataUrl: canonicalMask,
			compositeOptions: ctx.options?.composite,
		});
	} catch (e) {
		throw new AreaEditError("Compositing failed.", "COMPOSITE", e);
	}
}

/**
 * End-to-end constrained edit: resolve selection → validate → (cache) → generate → composite → verify.
 */
export async function runAreaEdit(
	ctx: RunAreaEditContext,
): Promise<AreaEditResult> {
	const t0 = performance.now();
	const resolvedPrompt = enrichAreaEditPrompt(ctx.prompt);
	const op = ctx.options?.operation ?? inferAreaEditOperation(resolvedPrompt);
	assertSupportedOperation(op);
	validatePrompt(ctx.prompt);

	const provider = ctx.provider ?? createGeminiAreaEditProvider();
	const timingsMs = {
		resolveMask: 0,
		generation: 0,
		composite: 0,
		verify: 0,
		total: 0,
	};

	const cacheHit = false;
	const seed = ctx.options?.seed;

	const original = await loadImage(ctx.originalImageUrl).catch((e) => {
		throw new AreaEditError("Could not load original image.", "IMAGE_LOAD", e);
	});
	const sceneW = original.width;
	const sceneH = original.height;
	if (!sceneW || !sceneH) {
		throw new AreaEditError(
			"Original image has invalid dimensions.",
			"INVALID_INPUT",
		);
	}

	const tResolve0 = performance.now();
	const canonicalMask = await resolveCanonicalMask(ctx, sceneW, sceneH);
	timingsMs.resolveMask = Math.round(performance.now() - tResolve0);

	const maskImg = await loadImage(canonicalMask).catch((e) => {
		throw new AreaEditError("Could not decode mask.", "MASK_GEOMETRY", e);
	});

	const [editablePixels, , editableFraction] = measureMaskCoverage({
		maskImg,
		width: sceneW,
		height: sceneH,
		editableLumAbove: 10,
	});
	validateMaskCoverage({ editablePixels, editableFraction });

	const instructionText = buildAreaEditInstruction(resolvedPrompt, op);
	const aspectRatio: GeminiAspectRatio =
		inferGeminiAspectRatioFromImage(original);
	const highQuality = ctx.options?.highQuality !== false;

	const cacheKey =
		ctx.cache &&
		buildAreaEditCacheKey({
			op,
			ar: aspectRatio,
			hq: highQuality,
			seed: seed ?? "absent",
			ins: djb2Hash(instructionText + resolvedPrompt),
			img: weakBlobFingerprint(ctx.originalImageUrl),
			msk: weakBlobFingerprint(canonicalMask),
		});

	const cached = await tryReturnCachedResult({
		cache: ctx.cache,
		cacheKey,
		t0,
		op,
		seed,
		timingsMs,
	});
	if (cached) return cached;

	const tGen0 = performance.now();
	const rawPatch = await generateRawPatch({
		provider,
		ctx,
		canonicalMask,
		instructionText,
		aspectRatio,
		highQuality,
	});
	timingsMs.generation = Math.round(performance.now() - tGen0);

	if (ctx.options?.skipComposite) {
		timingsMs.total = Math.round(performance.now() - t0);
		if (ctx.cache && cacheKey)
			await Promise.resolve(ctx.cache.set(cacheKey, rawPatch));
		return {
			dataUrl: rawPatch,
			meta: { cacheHit, operation: op, seed, timingsMs },
		};
	}

	const tComp0 = performance.now();
	const composed = await compositeGeneratedPatch({
		ctx,
		rawPatch,
		canonicalMask,
	});
	timingsMs.composite = Math.round(performance.now() - tComp0);

	const tVer0 = performance.now();
	let integrity = undefined;
	if (!ctx.options?.skipIntegrityVerify) {
		integrity = await verifyUnmaskedIntegrity({
			originalDataUrl: ctx.originalImageUrl,
			compositeDataUrl: composed,
			canonicalHardMaskDataUrl: canonicalMask,
		});
	}
	timingsMs.verify = Math.round(performance.now() - tVer0);

	timingsMs.total = Math.round(performance.now() - t0);

	if (ctx.cache && cacheKey) {
		await Promise.resolve(ctx.cache.set(cacheKey, composed));
	}

	return {
		dataUrl: composed,
		meta: {
			cacheHit,
			operation: op,
			seed,
			integrity,
			timingsMs,
		},
	};
}
