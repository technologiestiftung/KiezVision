import { MAX_EDITABLE_FRACTION, MIN_MASK_AREA_PIXELS } from "../constants";
import { AreaEditError } from "../errors";
import type { AreaEditOperation } from "../types";

export interface MaskCoverageValidationInput {
	editablePixels: number;
	editableFraction: number;
}

export function validatePrompt(prompt: string): void {
	const p = prompt.trim();
	if (!p) {
		throw new AreaEditError(
			"Prompt is required for area edit.",
			"INVALID_INPUT",
		);
	}
	if (p.length > 8000) {
		throw new AreaEditError("Prompt is too long.", "INVALID_INPUT");
	}
}

export function validateMaskCoverage({
	editablePixels,
	editableFraction,
}: MaskCoverageValidationInput): void {
	if (editablePixels < MIN_MASK_AREA_PIXELS) {
		throw new AreaEditError(
			`Selection too small — paint at least ~${MIN_MASK_AREA_PIXELS} pixels.`,
			"MASK_COVERAGE",
		);
	}
	if (editableFraction > MAX_EDITABLE_FRACTION) {
		throw new AreaEditError(
			`Selection covers nearly the whole frame (${(editableFraction * 100).toFixed(1)}%). Use Compare mode for global edits.`,
			"MASK_COVERAGE",
		);
	}
}

/** Future multi-tool registry hook. */
export function assertSupportedOperation(_op: AreaEditOperation): void {
	/* Reserved for gated beta operations */
}
