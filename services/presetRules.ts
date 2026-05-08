import { TransformationType } from '../types';

type EditMode = 'comparison' | 'mask';

const GLOBAL_CONSTRAINTS = [
  // Keep these general: they apply to *all* full-image transforms.
  'Maintain the original scene structure.',
  'Do NOT change building architecture, facades, windows, doors, signage, or balconies unless explicitly instructed.',
  'Do NOT add any text, labels, watermarks, or signatures.',
  'If unsure about placement, choose the safest option and keep changes confined to street/ground-level public space.',
].join(' ');

const PRESET_ADDONS: Partial<Record<TransformationType, string>> = {
  [TransformationType.ADD_TREES]: [
    'Add nature only where it fits.',
    'Allowed: sidewalks/curb edges (street trees, planter boxes), road surface (green corridor / pocket-park conversions), around street furniture (small planters), and rooftops/terraces when visible.',
    'Forbidden: building facades, windows, doors, and bare walls.',
    'Buildings: ONLY add greenery to balconies IF balconies exist, and only as balcony planter boxes or subtle vines contained to the balcony area.',
    'Fallback: if no balconies/rooftops are visible, keep all greenery on sidewalks/curb edges and street-level areas only.',
  ].join(' '),
  [TransformationType.ADD_WATER]: [
    'Add water only where it fits.',
    'Prefer: transform the road surface into a clear canal/waterway while keeping sidewalks and buildings intact.',
    'Also allowed: small, realistic sidewalk features (fountains, rain gardens, bioswales) that do not flood surrounding areas.',
    'Forbidden: water on building facades/windows/doors or flooding building interiors.',
    'Fallback: if uncertain, confine all water strictly to the road surface and curbside drainage features.',
  ].join(' '),
};

function isPresetPrompt(prompt: string): prompt is TransformationType {
  return (Object.values(TransformationType) as string[]).includes(prompt);
}

/**
 * Build the final prompt sent to the model.
 *
 * - In mask mode, we do NOT inject global constraints, because the user-selected
 *   mask is the authoritative placement constraint.
 * - In full-image mode, we always inject global constraints, and for known
 *   presets we append a preset-specific placement add-on.
 */
export function buildTransformPrompt(inputPrompt: string, opts: { editMode: EditMode }): string {
  const base = inputPrompt.trim();
  if (!base) return base;

  if (opts.editMode === 'mask') return base;

  if (isPresetPrompt(base)) {
    const addon = PRESET_ADDONS[base];
    if (addon) {
      return `${GLOBAL_CONSTRAINTS} ${addon}`;
    }
  }

  return `${GLOBAL_CONSTRAINTS} ${base}`;
}

