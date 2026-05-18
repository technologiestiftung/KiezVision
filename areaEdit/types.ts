/**
 * Public contract for constrained area generation (inpainting-style edits).
 */

export type GeminiAspectRatio = '1:1' | '3:4' | '4:3' | '9:16' | '16:9';

/** Semantic operation — drives prompt scaffolding; same compositing path today. */
export type AreaEditOperation =
  | 'object_insert'
  | 'inpaint'
  | 'object_replace'
  | 'background_edit'
  /** Reserved: multiple disjoint selections merged as a single bitwise mask before generation. */
  | 'multi_region';

/**
 * Supported selection modalities. Raster masks are authoritative for painted UI.
 */
export type AreaSelection =
  | {
      kind: 'raster';
      /** PNG/JPEG data URL; white/light = editable region after preprocessing. */
      dataUrl: string;
    }
  | {
      kind: 'bbox';
      /** 0–1 coordinates relative to full image width/height. */
      rect: { x: number; y: number; width: number; height: number };
    }
  | {
      kind: 'union';
      /** Combined with OR (max luminance per pixel). Nested unions flatten. */
      regions: AreaSelection[];
    };

export interface MaskCompositeOptions {
  /** Luminance below this maps to alpha 0 outside soft ramp (aligned with painter export). */
  lumLowCutoff?: number;
  lumHighCutoff?: number;
  featherPxClamp?: { min: number; max: number };
}

export interface AreaEditGenerateOptions {
  highQuality?: boolean;
  /** Forwarded to Gemini `GenerateContentConfig.seed` when set (best-effort determinism). */
  seed?: number;
  composite?: MaskCompositeOptions;
  /** Lower with seed + matching model version improves reproducibility. */
  modelTemperature?: number;
  operation?: AreaEditOperation;
  /** Skip post-verify step (tests / debugging only). */
  skipIntegrityVerify?: boolean;
  /** Abort after raw model output (no deterministic CPU composite). */
  skipComposite?: boolean;
}

export interface AreaEditIntegrityReport {
  passed: boolean;
  /** Max RGB L1 deviation observed on pixels firmly outside the hard mask. */
  maxChannelDeltaOutsideMask: number;
  /** Fraction of outside-mask pixels exceeding tolerance. */
  violationRate: number;
}

export interface AreaEditRunMeta {
  cacheHit: boolean;
  operation: AreaEditOperation;
  seed?: number;
  integrity?: AreaEditIntegrityReport;
  timingsMs: {
    resolveMask: number;
    generation: number;
    composite: number;
    verify: number;
    total: number;
  };
}

export interface AreaEditResult {
  dataUrl: string;
  meta: AreaEditRunMeta;
}

export interface AreaEditRequest {
  originalImageUrl: string;
  selection: AreaSelection;
  prompt: string;
  options?: AreaEditGenerateOptions;
}

/** Pluggable model backend (Gemini today; local or other APIs later). */
export interface AreaEditModelProvider {
  generateInpaintPatch(input: {
    imageDataUrl: string;
    maskDataUrl: string;
    instructionText: string;
    aspectRatio: GeminiAspectRatio;
    highQuality: boolean;
    seed?: number;
    temperature?: number;
  }): Promise<string>;
}

export interface AreaEditCache {
  get(key: string): Promise<string | undefined> | string | undefined;
  set(key: string, dataUrl: string): Promise<void> | void;
}
