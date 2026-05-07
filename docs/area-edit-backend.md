# Area-edit generation backend

This document describes the modular **area edit** subsystem under `areaEdit/`. It runs in the browser for KiezVision and composes Gemini image output with deterministic CPU masking so unchanged regions stay pinned to the original photograph.

## API surface (`areaEdit/index.ts`)

| Export                              | Purpose                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `runAreaEdit(ctx)`                  | Main entry: validates input, resolves mask, calls model provider, composites, verifies, optional cache write. |
| `createMemoryAreaEditCache(opts)`   | In-process LRU keyed by fingerprints of prompt + images + seed + operation.                                   |
| `AreaEditError` / `isAreaEditError` | Structured errors with codes (`INVALID_INPUT`, `MASK_GEOMETRY`, …).                                           |
| Types                               | `AreaSelection`, `AreaEditOperation`, `AreaEditModelProvider`, etc.                                           |

### Request shape

```ts
await runAreaEdit({
  originalImageUrl: string,    // data URL or fetchable URL
  selection:
    | { kind: 'raster'; dataUrl: string }
    | { kind: 'bbox'; rect: { x, y, width, height } }  // normalized 0–1
    | { kind: 'union'; regions: AreaSelection[] },
  prompt: string,
  options?: {
    operation?: AreaEditOperation,  // default `object_insert`
    highQuality?: boolean,           // default true
    seed?: number,                   // Gemini `GenerateContentConfig.seed`
    composite?: MaskCompositeOptions,
    skipComposite?: boolean,
    skipIntegrityVerify?: boolean,
    modelTemperature?: number,
  },
  cache?: AreaEditCache,
  provider?: AreaEditModelProvider,
});
```

Raster masks **must match the original image dimensions** (±2 px) before canonicalization—the pipeline rejects mismatches to avoid silent misregistration.

## Generation pipeline (`pipeline/runAreaEdit.ts`)

1. **Validate** — non-empty prompt, operation allowed (reserved for gated tools).
2. **Load scene** — read natural width × height from the photograph.
3. **Resolve selection** — produce a canonical **black / white PNG mask** aligned to scene pixels (`mask/resolveSelection.ts`). Union regions use per-pixel max (OR).
4. **Coverage gates** — minimum painted area (~48 px²) and maximum editable fraction (~92%) (`constants.ts`, `validation/`).
5. **Cache lookup** — key = sorted params + fingerprints of blobs + prompt hash (`util/hashKey.ts`).
6. **Provider.generateInpaintPatch** — default Gemini implementation (`providers/geminiAreaEditProvider.ts` → `generateMaskedInpaintImage` in `services/geminiService.ts`): text instruction first, then reference image, then mask; `temperature` defaults to `0.35` for constrained edits; `seed` forwarded when supplied (best-effort reproducibility).
7. **Composite** (`composite/compositePatch.ts`) unless `skipComposite`:
   - Luminance ramps + Gaussian feather build a soft **alpha matte** from the canon mask (no reliance on AI respecting boundaries alone).
   - Model output drawn with **`object-fit: cover`** parity, clipped with `destination-in` to matte, pasted with `source-over` on original.
8. **Post-verify** (`postprocess/verifyMaskBoundary.ts`) unless skipped: compares original vs composite on pixels **outside** hard mask (>128 luminance cutoff); exposes `violations`/`maxDelta` in `meta.integrity`.

## Mask handling logic

| Stage              | File                          | Behaviour                                                                         |
| ------------------ | ----------------------------- | --------------------------------------------------------------------------------- |
| Union / bbox       | `mask/resolveSelection.ts`    | Renders to BW mask matching scene geometry.                                       |
| Binarization       | Same                          | Mirrors painter export: editable if average RGB > threshold.                      |
| Soft matte         | `composite/compositePatch.ts` | Ramp [28,120] luminance → alpha + blur feather clamped relative to shortest side. |
| Coverage analytics | `mask/analyzeCoverage.ts`     | Counts editable fraction for validation.                                          |

## Errors (`errors.ts`)

- `INVALID_INPUT` — blank prompt / bad dimensions.
- `MASK_GEOMETRY` — raster size mismatch union failure upstream.
- `MASK_COVERAGE` — too tiny or flood-fill selections.
- `IMAGE_LOAD` — decode failure.
- `COMPOSITE` — Canvas / compositing exception.
- `UPSTREAM` — Gemini / networking errors surfaced with cause.

React UI catches `AreaEditError` explicitly to surface user-readable messages (`App.tsx`).

## Performance considerations

- **Canvas work** scales with megapixels; compositing stays O(pixels)—single-threaded browser main paint.
- **Model round-trip** dominates latency; LRU cache skips generation for fingerprint-identical repeats.
- **Prefetch** embeddings not used today; extension point for server-side cropping of hi-res originals before Gemini when moving to backend.

## Caching strategy

- **Tier 1 (current):** synchronous `Map` LRU in memory keyed by deterministic hash of prompts + truncated blob fingerprints (`weakBlobFingerprint`).
- **Tier 2 (future):** persist to **IndexedDB** with content-addressable blob storage for offline replay; TTL per city session.
- **Tier 3 (future):** server-side KV (Redis/Cloud CDN) keyed by perceptual hashes if API moves off-device.

⚠ Fingerprints truncate long URLs; collision risk is negligible for UX cache—not for cryptographic integrity.

## Extensibility roadmap

Operations (`AreaEditOperation`) map to scaffolded instructions in `prompts/buildOperationPrompt.ts`:

- `inpaint`, `object_replace`, `background_edit`, `multi_region` share the composite path; divergence is instructional + optional downstream parameters (blur depth, outpainting bbox).
- **Multi-region editing** accepts `selection.kind === 'union'` today; finer **per-region prompts** slot in as `{ regionId, prompt }[]` atop the same mask resolver.

Implement new tools by implementing `AreaEditModelProvider` and optionally replacing `compositePatchOverOriginal` with tool-specific shaders.

## Seeds and reproducibility

`seed` forwards to Gemini’s documented `seed` parameter on `GenerateContentConfig`; combined with fixed `temperature` and model version pinning, results are **mostly** repeatable. Non-determinism can still emerge from infra updates—log `timingsMs`/`meta` during QA regressions.

## Test coverage plan

| Layer                          | Run                  | Targets                                                    |
| ------------------------------ | -------------------- | ---------------------------------------------------------- |
| Unit (Vitest / Node)           | `npm test`           | Validation, hashing, prompt builder.                       |
| Component (Vitest / happy-dom) | future               | Thin smoke: `resolveSelectionToMask` for bbox correctness. |
| Visual / golden                | manual or Playwright | End-to-end area edit after model responses.                |

Run unit tests:

```bash
npm test
```

Coverage (optional):

```bash
npx vitest run --coverage
```
