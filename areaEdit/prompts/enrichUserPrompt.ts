import type { AreaEditOperation } from '../types';
import { TransformationType } from '../../types';
import { PRESET_ADDONS, isPresetPrompt } from '../../services/presetRules';

type SubjectHint = { pattern: RegExp; hint: string };

const SUBJECT_HINTS: SubjectHint[] = [
  {
    pattern:
      /playground|swing|slides?|seesaw|spielplatz|schaukel|wippe|kletter|sandkasten|play\s*structure/i,
    hint: 'Render recognizable playground play equipment (e.g. metal swing frame with hanging seat, or slide) sized for children, with realistic safety surfacing or grass if appropriate, bolted to the ground — not a park bench, bike rack, tree planter, or random street furniture.',
  },
  {
    pattern: /bench|sitzbank/i,
    hint: 'Render a public park bench with seat/back slats, grounded on pavement, adult scale relative to doors or people — not playground equipment.',
  },
  {
    pattern: /bike\s*rack|bicycle\s*parking|fahrradständer|fahrradbügel/i,
    hint: 'Render metal U-racks or staple bicycle stands anchored in the pavement, not benches or playground items.',
  },
  {
    pattern: /tree|baum|planter|shrub|hedge|hecke|flower|blumen|garden|beet/i,
    hint: 'Render living plants with believable soil/planter boundaries and scale to the sidewalk — not furniture or play equipment.',
  },
  {
    pattern: /shop|store|facade|façade|storefront|laden|geschäft|flower\s*shop|blumenladen/i,
    hint: 'Re-skin the existing storefront opening in the mask: keep bay width, door/window positions, and perspective; change signage/display/content only as requested.',
  },
  {
    pattern: /bin|litter|trash|müll|tonne|bsr/i,
    hint: 'Render Berlin-style street waste containers on the pavement plane, human-scale, not oversized props.',
  },
  {
    pattern: /lamp|light|laterne|beleuchtung/i,
    hint: 'Render a street lighting pole or luminaire vertical to the ground, matching urban Berlin fixtures.',
  },
  {
    pattern: /café|cafe|terrace|outdoor\s*seat|gastronom/i,
    hint: 'Render outdoor café tables/chairs on the sidewalk with clearance for walking, consistent with European street cafés.',
  },
];

/** Pick the best area-edit operation from free text (presets included). */
export function inferAreaEditOperation(prompt: string): AreaEditOperation {
  const p = prompt.toLowerCase();
  if (
    /\b(remove|delete|erase|clear|strip|entfern|lösch|weg damit)\b/.test(p) &&
    !/\b(add|insert|place|put|hinzu|füg)\b/.test(p)
  ) {
    return 'object_replace';
  }
  if (/\b(replace|swap|change\b.+\bto|turn\s+into|ersetz|umwandeln)\b/.test(p)) {
    return 'object_replace';
  }
  if (/\b(sky|weather|sunny|sunset|cloud|overcast|himmel|wetter|bewölk)\b/.test(p)) {
    return 'background_edit';
  }
  if (/\b(repair|inpaint|fix\s+seam|fill\s+gap|texture|continue\s+the)\b/.test(p)) {
    return 'inpaint';
  }
  return 'object_insert';
}

/**
 * Turn UI / preset tokens into a model-ready subject description without changing user intent.
 */
export function enrichAreaEditPrompt(rawPrompt: string): string {
  const base = rawPrompt.trim();
  if (!base) return base;

  if (isPresetPrompt(base)) {
    const addon = PRESET_ADDONS[base as TransformationType];
    return addon ? `${base} ${addon}` : base;
  }

  let enriched = base;
  for (const { pattern, hint } of SUBJECT_HINTS) {
    if (pattern.test(base)) {
      enriched = `${base}. ${hint}`;
      break;
    }
  }

  return enriched;
}
