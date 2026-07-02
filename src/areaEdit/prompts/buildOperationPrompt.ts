import type { AreaEditOperation } from "../types";

const OPERATION_HINT: Record<AreaEditOperation, string> = {
	object_insert:
		"Insert or add exactly the object(s) named in USER CONTENT — correct type, materials, and count — ONLY inside the white mask. Do not substitute a different object category (e.g. bench instead of swing).",
	inpaint:
		"Fill plausible scene detail inside the mask (repair, extend texture, harmonize seams). Do not invent unrelated large objects unless the user asks.",
	object_replace:
		"Remove or replace ENTITIES clearly implied by the user inside the mask only — keep unrelated scene elements untouched.",
	background_edit:
		"Adjust environment behind foreground content only within the masked window (sky, distant façade, sidewalk continuation). Respect occlusions.",
	multi_region:
		"Apply the user request consistently across ALL masked regions; each disjoint white zone may be edited, everything else unchanged.",
};

/**
 * Gemini-facing instruction body. Kept deterministic w.r.t. user text + operation enum.
 */
export function buildAreaEditInstruction(
	userPrompt: string,
	operation: AreaEditOperation,
): string {
	const op = OPERATION_HINT[operation] ?? OPERATION_HINT.object_insert;
	return `LOCAL INPAINTING / AREA EDIT (read carefully)

The next two images arrive in order:
1) FIRST IMAGE — reference photograph (REF).
2) SECOND IMAGE — raster mask SAME pixel size as REF. White/light = ALLOWED EDIT REGION. Black/dark = IMMUTABLE COPY from REF verbatim.

TASK SCOPE (${operation}):
${op}

USER CONTENT (only where mask is white) — follow literally; this overrides generic street-furniture assumptions:
"""${sanitizeUserPrompt(userPrompt)}"""

RULES:
• ONE output image; identical canvas size framing and character as REF.
• Pixels OUTSIDE the white zone = bit-identical to REF wherever possible (same façade, pavement, vehicles, foliage, sky slices).
• INSIDE white: integrate content with REF lighting direction, intensity, white balance, perspective, exposure and grain — natural contact shadows, scale, occlusion. Keep the subject anchored to the same ground plane and position implied by the mask — do not shift, float, or resize vs surroundings.
• Match the photographic sharpness and noise of REF; no blur, bloom, or soft paste-on look on new pixels.
• No plain white/light-gray slabs, neutral studio fills, or fog hiding context. No text, watermarks, or logos.

If a masked pixel is ambiguous, infer continuous street detail that stitches from adjacent unmasked regions.`;
}

function sanitizeUserPrompt(s: string): string {
	return s.replace(/"""+/g, '"').trim().slice(0, 4000);
}
