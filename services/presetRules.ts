import { TransformationType } from "../types";

type EditMode = "comparison" | "mask";

/**
 * Geometry and placement cues for street scenes — used in full-image mode (via globals)
 * and appended in mask mode so area edits still respect ground plane and scale.
 */
/** Only the attached location map governs this run — no prior masks or history regions. */
export const MASK_CURRENT_MAP_ONLY =
  "Only the location map in this exact request (image 2) defines where to edit: ignore earlier area selections, prior masks from conversation, or any region outside the white pixels shown here. Apply the PRIMARY EDIT REQUEST solely under those white pixels on (1).";

/** Mask mode: black map = copy reference exactly — no edits, props, or relighting there. */
export const MASK_BLACK_UNCHANGED =
  "Far from the brush, black on the location map means leave that part of the scene identical to the reference: no new objects, relighting, or global “improvements” there.";

/** Allow the visible edit to extend slightly past the stroke so objects are not chopped at the mask edge. */
export const MASK_EDGE_COMPLETION =
  "The white brush marks minimum intent, not a hard cut line in the final image: complete lamps, trees, benches, awnings, and façade edits fully—even if that requires painting a modest band beyond the white strokes—without altering distant unrelated areas.";

/** Mask mode: only implement the user’s words inside white; no scope creep. */
export const MASK_NO_UNREQUESTED_EXTRAS =
  "Do not invent extras the user did not ask for (random plants, bins, people, signs, or “street dressing”). Finishing the requested object slightly past the stroke is allowed; unrelated distant areas stay as in the reference.";

/** Spatial cues apply only under the brush, not as a license to edit the whole street. */
export const MASK_SPATIAL_SCOPE =
  "Ground-plane and scale cues apply only inside the white mask; they are not permission to modify black areas.";

/** Mask mode: row retail — neighbor bays stay untouched (e.g. one shop → flower shop). */
export const MASK_ROW_RETAIL_FACADES =
  "If the white mask covers part of a parade of shops, keep every adjoining unit’s façade, glazing, and signage identical to the reference wherever the map is black.";

/** Mask mode: lock edits to the reference bay / openings so results are not mis-scaled vs the scene. */
export const MASK_REFERENCE_GEOMETRY =
  "Fit the edit to the real area behind the brush: keep storefront bay width, wall plane, perspective, and ground line; preserve door and window positions unless the user explicitly asks to change structure. Re-skin the existing opening rather than pasting a wrongly scaled façade.";

export const SPATIAL_AWARENESS = [
  "Read the photograph as a 3D scene: separate sidewalk from carriageway using curbs, curb cuts, lane markings, and where building walls meet the ground.",
  "Place every addition on the correct supporting surface (paving, asphalt, plaza tiles) with full ground contact and consistent perspective / vanishing lines — nothing floating above the floor.",
  "Infer scale from visible cues (door and storefront heights, windows, cars, people, bike wheels); street furniture must look human-sized with believable depth and footprint for the free space.",
  "Respect negative space: leave enough clear width for walking and turning; if the sidewalk is narrow, use one smaller piece or fewer repeats instead of crowding.",
].join(" ");

const GLOBAL_CONSTRAINTS = [
  // Keep these general: they apply to *all* full-image transforms.
  "Maintain the original scene structure.",
  "Do NOT change building architecture, facades, windows, doors, signage, or balconies unless explicitly instructed.",
  "Do NOT add any text, labels, watermarks, or signatures.",
  "If unsure about placement, choose the safest option and keep changes confined to street/ground-level public space.",
  SPATIAL_AWARENESS,
].join(" ");

/** Every preset: no scope creep into unrelated objects or “street dressing”. */
export const PRESET_SCOPE_LOCK =
  "Apply ONLY what this preset describes. Do NOT add unrelated trees, benches, bike racks, planters, water, canals, new vehicles, people, bins, café furniture, or other street dressing unless this preset explicitly asks for that category. Keep existing scene content unless the preset says to remove or replace it.";

/** Benches vs racks: separate zones, racks at the street edge. */
export const STREET_FURNITURE_SEPARATION =
  "Never overlap or stack benches and bicycle racks. Keep at least ~1.5 m clear space between a bench and the nearest rack. Bicycle racks belong on the sidewalk edge beside the curb/carriageway (street side), not in the middle of the footway and not directly in front of benches.";

export const PRESET_ADDONS: Partial<Record<TransformationType, string>> = {
  [TransformationType.SUNNY_DAY]: [
    PRESET_SCOPE_LOCK,
    "Change ONLY sky, sun direction, exposure, color temperature, and shadows to a bright clear summer afternoon.",
    "Forbidden: adding or removing trees, plants, benches, bike racks, water, vehicles, people, signs, façades changes, or any new physical objects.",
    "Keep the same buildings, pavement layout, and street furniture as the reference; relight them only.",
  ].join(" "),
  [TransformationType.REMOVE_CARS]: [
    PRESET_SCOPE_LOCK,
    "Remove cars, trucks, vans, and other motor vehicles from the carriageway only; fill gaps with consistent asphalt or paving.",
    "Forbidden: adding trees, benches, bike racks, water, people, or other new street elements.",
    "Do not change weather, sky, or building architecture.",
  ].join(" "),
  [TransformationType.ADD_TREES]: [
    PRESET_SCOPE_LOCK,
    "Add nature only where it fits.",
    "Align planters and tree pits with the sidewalk plane; tree trunks vertical in world space, canopy volume plausible for the distance to facades and overhead wires.",
    "Allowed: sidewalks/curb edges (street trees, planter boxes), road surface (green corridor / pocket-park conversions), around street furniture (small planters), and rooftops/terraces when visible.",
    "Forbidden: building facades, windows, doors, and bare walls.",
    "Buildings: ONLY add greenery to balconies IF balconies exist, and only as balcony planter boxes or subtle vines contained to the balcony area.",
    "Fallback: if no balconies/rooftops are visible, keep all greenery on sidewalks/curb edges and street-level areas only.",
  ].join(" "),
  [TransformationType.ADD_WATER]: [
    PRESET_SCOPE_LOCK,
    "Add water only where it fits.",
    "Water surface must lie in the horizontal plane of the roadway or basin it replaces; match reflections and horizon to the existing scene lighting.",
    "Prefer: transform the road surface into a clear canal/waterway while keeping sidewalks and buildings intact.",
    "Also allowed: small, realistic sidewalk features (fountains, rain gardens, bioswales) that do not flood surrounding areas.",
    "Forbidden: water on building facades/windows/doors or flooding building interiors.",
    "Fallback: if uncertain, confine all water strictly to the road surface and curbside drainage features.",
  ].join(" "),
  [TransformationType.ADD_BENCH]: [
    PRESET_SCOPE_LOCK,
    "Add one or more realistic public park benches only — do not add bike racks, trees, or other furniture in the same edit.",
    "Render benches with sharp, clean edges and legible slats/hardware; avoid glow, haze, or soft bloom around the furniture.",
    "Seat height and depth must match adult ergonomics relative to doors or people in frame; orient benches parallel to the dominant curb or facade line unless the layout clearly dictates otherwise.",
    "Place benches on the building-side half of the sidewalk or plaza (set back from the curb), leaving the curb edge free for bicycle parking.",
    STREET_FURNITURE_SEPARATION,
    "Allowed: sidewalks, plazas, wide curb strips, tram/bus waiting areas, and pocket parks.",
    "Forbidden: blocking driveways, bike lanes, crosswalks, doorways, vehicle lanes, or placing benches on the street-edge strip where racks belong.",
    "Keep benches grounded, correctly scaled, and consistent with Berlin-style street furniture.",
  ].join(" "),
  [TransformationType.ADD_BIKE_RACK]: [
    PRESET_SCOPE_LOCK,
    "Add practical bicycle parking only (metal U-racks or staple racks) — do not add benches, trees, or other furniture in the same edit.",
    "Keep metal tubes and welds crisp with sharp edges; avoid fuzzy or painterly blur on the rack silhouette.",
    "Mount racks flush to the paving plane; spacing between loops should fit real bicycle lengths (~1.6–1.9m) at the scale implied by the photo.",
    "Place every rack on the sidewalk edge adjacent to the curb or carriageway (street side of the footway), aligned parallel to the road — typical Berlin curbside parking.",
    STREET_FURNITURE_SEPARATION,
    "Forbidden: mid-sidewalk placement, blocking pedestrian flow, wheelchair routes, hydrants, doorways, vehicle lanes, or overlapping existing benches.",
    "Use realistic metal racks (loops, staples, or grid stands) anchored to the pavement; do not attach racks to glass facades.",
  ].join(" "),
};

export function isPresetPrompt(prompt: string): prompt is TransformationType {
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
export function buildTransformPrompt(
  inputPrompt: string,
  opts: { editMode: EditMode },
): string {
  const base = inputPrompt.trim();
  if (!base) return base;

  if (opts.editMode === "mask") {
    const maskCore = `${MASK_CURRENT_MAP_ONLY} ${MASK_BLACK_UNCHANGED} ${MASK_EDGE_COMPLETION} ${MASK_NO_UNREQUESTED_EXTRAS} ${MASK_SPATIAL_SCOPE} ${MASK_REFERENCE_GEOMETRY} ${MASK_ROW_RETAIL_FACADES}`;
    if (isPresetPrompt(base)) {
      const addon = PRESET_ADDONS[base];
      if (addon) return `${base} ${maskCore} ${SPATIAL_AWARENESS} ${addon}`;
    }
    return `${base} ${maskCore} ${SPATIAL_AWARENESS}`;
  }

  if (isPresetPrompt(base)) {
    const addon = PRESET_ADDONS[base];
    if (addon) {
      return `${GLOBAL_CONSTRAINTS} ${base} ${addon}`;
    }
    return `${GLOBAL_CONSTRAINTS} ${PRESET_SCOPE_LOCK} ${base}`;
  }

  return `${GLOBAL_CONSTRAINTS} ${base}`;
}

/** Area edit: user/preset request only — mask rules are sent separately in the API template. */
/** False for weather-only or vehicle-removal presets (no new street furniture). */
export function presetAllowsNewObjects(finalPrompt: string): boolean {
  if (/Change ONLY sky|Adjust only weather and lighting/i.test(finalPrompt)) {
    return false;
  }
  if (
    /Remove cars, trucks/i.test(finalPrompt) &&
    /Forbidden: adding trees, benches, bike racks/i.test(finalPrompt)
  ) {
    return false;
  }
  return true;
}

export function buildMaskTransformRequest(inputPrompt: string): string {
  const base = inputPrompt.trim();
  if (!base) return base;
  if (isPresetPrompt(base)) {
    const addon = PRESET_ADDONS[base];
    if (addon) return `${base} ${addon}`;
  }
  return base;
}
