import { TransformationType } from '../types';

type EditMode = 'comparison' | 'mask';

/**
 * Geometry and placement cues for street scenes — used in full-image mode (via globals)
 * and appended in mask mode so area edits still respect ground plane and scale.
 */
/** Mask mode: black map = copy reference exactly — no edits, props, or relighting there. */
export const MASK_BLACK_UNCHANGED =
  'Far from the brush, black on the location map means leave that part of the scene identical to the reference: no new objects, relighting, or global “improvements” there.';

/** Allow the visible edit to extend slightly past the stroke so objects are not chopped at the mask edge. */
export const MASK_EDGE_COMPLETION =
  'The white brush marks minimum intent, not a hard cut line in the final image: complete lamps, trees, benches, awnings, and façade edits fully—even if that requires painting a modest band beyond the white strokes—without altering distant unrelated areas.';

/** Mask mode: only implement the user’s words inside white; no scope creep. */
export const MASK_NO_UNREQUESTED_EXTRAS =
  'Do not invent extras the user did not ask for (random plants, bins, people, signs, or “street dressing”). Finishing the requested object slightly past the stroke is allowed; unrelated distant areas stay as in the reference.';

/** Spatial cues apply only under the brush, not as a license to edit the whole street. */
export const MASK_SPATIAL_SCOPE =
  'Ground-plane and scale cues apply only inside the white mask; they are not permission to modify black areas.';

/** Mask mode: row retail — neighbor bays stay untouched (e.g. one shop → flower shop). */
export const MASK_ROW_RETAIL_FACADES =
  'If the white mask covers part of a parade of shops, keep every adjoining unit’s façade, glazing, and signage identical to the reference wherever the map is black.';

const SPATIAL_AWARENESS = [
  'Read the photograph as a 3D scene: separate sidewalk from carriageway using curbs, curb cuts, lane markings, and where building walls meet the ground.',
  'Place every addition on the correct supporting surface (paving, asphalt, plaza tiles) with full ground contact and consistent perspective / vanishing lines — nothing floating above the floor.',
  'Infer scale from visible cues (door and storefront heights, windows, cars, people, bike wheels); street furniture must look human-sized with believable depth and footprint for the free space.',
  'Respect negative space: leave enough clear width for walking and turning; if the sidewalk is narrow, use one smaller piece or fewer repeats instead of crowding.',
].join(' ');

const GLOBAL_CONSTRAINTS = [
  // Keep these general: they apply to *all* full-image transforms.
  'Maintain the original scene structure.',
  'Do NOT change building architecture, facades, windows, doors, signage, or balconies unless explicitly instructed.',
  'Do NOT add any text, labels, watermarks, or signatures.',
  'If unsure about placement, choose the safest option and keep changes confined to street/ground-level public space.',
  SPATIAL_AWARENESS,
].join(' ');

const PRESET_ADDONS: Partial<Record<TransformationType, string>> = {
  [TransformationType.ADD_TREES]: [
    'Add nature only where it fits.',
    'Align planters and tree pits with the sidewalk plane; tree trunks vertical in world space, canopy volume plausible for the distance to facades and overhead wires.',
    'Allowed: sidewalks/curb edges (street trees, planter boxes), road surface (green corridor / pocket-park conversions), around street furniture (small planters), and rooftops/terraces when visible.',
    'Forbidden: building facades, windows, doors, and bare walls.',
    'Buildings: ONLY add greenery to balconies IF balconies exist, and only as balcony planter boxes or subtle vines contained to the balcony area.',
    'Fallback: if no balconies/rooftops are visible, keep all greenery on sidewalks/curb edges and street-level areas only.',
  ].join(' '),
  [TransformationType.ADD_WATER]: [
    'Add water only where it fits.',
    'Water surface must lie in the horizontal plane of the roadway or basin it replaces; match reflections and horizon to the existing scene lighting.',
    'Prefer: transform the road surface into a clear canal/waterway while keeping sidewalks and buildings intact.',
    'Also allowed: small, realistic sidewalk features (fountains, rain gardens, bioswales) that do not flood surrounding areas.',
    'Forbidden: water on building facades/windows/doors or flooding building interiors.',
    'Fallback: if uncertain, confine all water strictly to the road surface and curbside drainage features.',
  ].join(' '),
  [TransformationType.ADD_BENCH]: [
    'Add one or more realistic public park benches along the sidewalk or plaza, matching the local street style and materials.',
    'Render benches with sharp, clean edges and legible slats/hardware; avoid glow, haze, or soft bloom around the furniture.',
    'Seat height and depth must match adult ergonomics relative to doors or people in frame; orient benches parallel to the dominant curb or facade line unless the layout clearly dictates otherwise.',
    'Place benches only where they fit.',
    'Allowed: sidewalks, plazas, wide curb strips, tram/bus waiting areas, and pocket parks.',
    'Forbidden: blocking driveways, bike lanes, crosswalks, doorways, or vehicle lanes.',
    'Keep benches grounded, correctly scaled, and consistent with Berlin-style street furniture.',
  ].join(' '),
  [TransformationType.ADD_BIKE_RACK]: [
    'Add practical bicycle parking such as metal U-racks or staple racks on the sidewalk, spaced realistically for several bikes.',
    'Keep metal tubes and welds crisp with sharp edges; avoid fuzzy or painterly blur on the rack silhouette.',
    'Mount racks flush to the paving plane; spacing between loops should fit real bicycle lengths (~1.6–1.9m) at the scale implied by the photo.',
    'Place racks only where they fit.',
    'Allowed: sidewalks set back from the curb, plaza edges, and transit stops where racks are common.',
    'Forbidden: blocking pedestrian flow, wheelchair routes, hydrants, or vehicle lanes.',
    'Use realistic metal racks (loops, staples, or grid stands) anchored to the pavement; do not attach racks to glass facades.',
  ].join(' '),
};

function isPresetPrompt(prompt: string): prompt is TransformationType {
  return (Object.values(TransformationType) as string[]).includes(prompt);
}

/**
 * Build the final prompt sent to the model.
 *
 * - In mask mode, append strict “black unchanged / no global extras” rules plus row-retail
 *   hints; spatial awareness is scoped to the white region only.
 * - In full-image mode, we inject global constraints (including spatial awareness)
 *   and, for known presets, preset-specific add-ons.
 */
export function buildTransformPrompt(inputPrompt: string, opts: { editMode: EditMode }): string {
  const base = inputPrompt.trim();
  if (!base) return base;

  if (opts.editMode === 'mask') {
    const maskCore = `${MASK_BLACK_UNCHANGED} ${MASK_EDGE_COMPLETION} ${MASK_NO_UNREQUESTED_EXTRAS} ${MASK_SPATIAL_SCOPE} ${MASK_ROW_RETAIL_FACADES}`;
    if (isPresetPrompt(base)) {
      const addon = PRESET_ADDONS[base];
      if (addon) return `${base} ${maskCore} ${SPATIAL_AWARENESS} ${addon}`;
    }
    return `${base} ${maskCore} ${SPATIAL_AWARENESS}`;
  }

  if (isPresetPrompt(base)) {
    const addon = PRESET_ADDONS[base];
    if (addon) {
      return `${GLOBAL_CONSTRAINTS} ${addon}`;
    }
  }

  return `${GLOBAL_CONSTRAINTS} ${base}`;
}

