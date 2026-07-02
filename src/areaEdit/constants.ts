import type { MaskCompositeOptions } from "./types";

export const DEFAULT_COMPOSITE: Required<MaskCompositeOptions> = {
	lumLowCutoff: 40,
	lumHighCutoff: 200,
	featherPxClamp: { min: 1, max: 5 },
};

/** Ignore tiny stray brush noise. */
export const MIN_MASK_AREA_PIXELS = 48;

/** Reject degenerate full-frame masks (accidental flood-fill). */
export const MAX_EDITABLE_FRACTION = 0.92;

/** Post-composite check: allowable drift on nominally untouched pixels (8-bit RGB). */
export const INTEGRITY_TOLERANCE = 14;
