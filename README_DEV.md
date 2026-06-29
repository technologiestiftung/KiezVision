# KiezVision — Development guide

Technical documentation for local setup, configuration, and how the application works under the hood.

## Table of contents

- [Getting started](#getting-started)
- [Configuration](#configuration)
- [How the app works](#how-the-app-works)
- [How the technology works](#how-the-technology-works)
- [Project structure](#project-structure)
- [Development commands](#development-commands)
- [Browser support](#browser-support)
- [Attribution](#attribution)

---

## Getting started

**Prerequisites:** Node.js 18 or later

```bash
git clone https://github.com/technologiestiftung/KiezVision.git
cd KiezVision
npm install
cp .env.example .env.local
```

Add your API keys to `.env.local` (see [Configuration](#configuration)), then start the dev server:

```bash
npm run dev
```

Open **http://localhost:3000/** in a Chromium-based browser (Chrome, Edge, Brave, Arc).

---

## Configuration

Create `.env.local` from [`.env.example`](.env.example):

| Variable | Required | Description |
| --- | --- | --- |
| `GEMINI_API_KEY` or `CUSTOM_GEMINI_API_KEY` | Yes | Google Gemini API key for image generation and location grounding |
| `MAPILLARY_ACCESS_TOKEN` | Recommended | Mapillary Graph API token for real street imagery |

If `MAPILLARY_ACCESS_TOKEN` is missing, street search cannot load Mapillary candidates and the app will surface an empty picker or error depending on context.

Keys are injected at build time through Vite `define` in [`vite.config.ts`](vite.config.ts). They are embedded in the client bundle — use restricted API keys and do not commit `.env.local`.

---

## How the app works

KiezVision is a single-page React application with four main views, routed via React Router:

| Route | View | Purpose |
| --- | --- | --- |
| `/` | Home | Search for a Berlin location, upload photos, or capture from camera |
| `/edit` | Editor | Transform images, compare results, and apply area-specific edits |
| `/library` | Image library | Browse and reopen saved visions |
| `/image-gallery` | Upload gallery | Review multiple uploaded files before editing |

### Typical workflow

1. **Acquire a base image**
   - **Street search:** Enter an address or pick a Berlin district. The app geocodes the query (OpenStreetMap Nominatim, bounded to Berlin) and opens the Mapillary picker with nearby street-level photos ranked by distance.
   - **Upload / camera:** Select one or more local images (HEIC supported) or capture a photo via the device camera. Multiple uploads open the gallery view for selection.

2. **Edit in the editor**
   - The chosen image becomes the **reference frame**. All transformations build on the current version in an undo-style **history stack**.
   - Two edit modes are available:
     - **Compare:** Full-frame AI transformation with a before/after slider.
     - **Area edit:** Paint a mask on the image, then describe what should change inside that region.

3. **Apply transformations**
   - **Presets** encode curated urban interventions (trees, benches, bike racks, car removal, sunny-day relighting, and more). Each preset carries strict scope rules so the model does not add unrelated street furniture.
   - **Custom prompts** accept free-text instructions in English or German.
   - **High quality** toggles a higher-resolution model configuration where supported.

4. **Review and export**
   - Use the history panel to step back through versions.
   - Download the current image or save it to the **library**.
   - Library entries can be stored in the browser and, on supported browsers, written to a user-selected folder on disk (full PNG + JPEG thumbnail).

5. **Change imagery source**
   - From the editor, users can reopen the Mapillary picker to swap the underlying street photo while keeping the session context.

### Editor modes in detail

**Compare mode** sends the entire current image to Gemini with a structured prompt assembled from preset rules and spatial constraints. The result replaces the current frame and the UI switches to a side-by-side before/after comparison.

**Area edit mode** requires the user to paint a white mask over the region of interest. On generate:

- The brush mask is exported from an HTML canvas aligned to the image (`InpaintCanvas`).
- The mask is treated as a **placement hint**, not a hard crop — the model may extend objects slightly beyond the stroke for natural completion.
- After generation, a deterministic **CPU compositing** step blends the model output with the original photograph so pixels outside the mask remain unchanged.

Presets are disabled in area edit until a mask is painted, preventing accidental full-frame runs.

---

## How the technology works

KiezVision runs entirely in the browser. There is no custom backend server; external APIs are called directly from the client using keys injected at build time via Vite environment variables.

### Architecture overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser (React)                          │
├──────────────┬──────────────────────┬───────────────────────────┤
│   App.tsx    │     Components       │      Domain modules       │
│  routing,    │  InpaintCanvas,      │  areaEdit/  (mask pipeline)│
│  state, UI   │  BeforeAfterSlider,  │  services/  (API clients) │
│              │  ImagerySelection…   │  presetRules (prompt DSL) │
└──────┬───────┴──────────┬───────────┴─────────────┬─────────────┘
       │                  │                         │
       ▼                  ▼                         ▼
  localStorage      Canvas 2D /              Google Gemini API
  IndexedDB         File System Access       Mapillary Graph API
                    (library folder)         OpenStreetMap Nominatim
```

### Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS (utility classes) |
| Routing | React Router 7 |
| Motion | Motion (Framer Motion successor) |
| Build | Vite 6 |
| Image AI | `@google/genai` — Gemini image models with `responseModalities: [IMAGE]` |
| Street imagery | Mapillary Graph API |
| Geocoding | OpenStreetMap Nominatim (Berlin-bounded forward geocode) |
| Local persistence | `localStorage` (library metadata), IndexedDB (folder handle), File System Access API (on-disk PNGs) |

### Image acquisition pipeline

**Mapillary path**

1. `geocodeBerlin()` resolves a search string to `{ lat, lng, displayName }` via Nominatim with a Berlin viewbox.
2. `fetchMapillaryCandidates()` queries the Mapillary Graph API for images within a configurable radius (default 120 m), sorted by haversine distance.
3. The user selects a thumbnail in `ImagerySelectionModal`. The full-resolution image URL is fetched and converted to a displayable data URL (`toDisplayableDataUrl`) to avoid CORS issues during canvas operations.
4. The image is loaded into the editor as the original reference.

**Upload path**

- Files are read as data URLs. HEIC/HEIF images are converted client-side via `heic2any`.
- Single uploads go directly to the editor; multiple uploads populate `uploadedGallery` on `/image-gallery`.

### Full-frame transformation pipeline

`handleTransform()` in `App.tsx` orchestrates generation:

1. Normalize the current image to a data URL if it originated from a remote URL.
2. If **Compare mode:** infer the best Gemini aspect ratio from image dimensions, build a prompt via `buildTransformPrompt()` (preset rules + global spatial constraints), and call `transformImage()` in `services/geminiService.ts`.
3. If **Area edit mode:** export the raster mask from `InpaintCanvas`, then call `runAreaEdit()` (see below).
4. Append the result to history and update the current image pointer.

`geminiService.ts` handles API communication:

- Resolves API keys from `API_KEY`, `CUSTOM_GEMINI_API_KEY`, or `GEMINI_API_KEY`.
- Retries on HTTP 429 / quota errors with exponential backoff.
- Sends multimodal requests (text + inline image bytes) with correct MIME types (JPEG vs PNG).
- Parses inline image parts from the Gemini response.

Preset and mask prompts are governed by `services/presetRules.ts` — a declarative rule set that locks scope (e.g. sunny-day relighting must not add trees), enforces spatial placement on sidewalks and façades, and separates incompatible street furniture.

### Area edit pipeline

The `areaEdit/` module implements constrained inpainting with post-generation guarantees:

```
User mask (canvas)
       │
       ▼
resolveSelectionToMask()  ── validate dimensions match original
       │
       ▼
buildAreaEditInstruction() + enrichAreaEditPrompt()
       │
       ▼
GeminiAreaEditProvider     ── multimodal: text + reference + mask
       │
       ▼
compositePatchOverOriginal()  ── CPU alpha blend; unmasked pixels pinned
       │
       ▼
verifyUnmaskedIntegrity()     ── boundary check (optional skip)
       │
       ▼
Final data URL
```

Key design decisions:

- The mask is **location metadata**, not content to reproduce — prompts explicitly forbid painting brush strokes into the output.
- Mask edges use a soft alpha ramp and modest dilation so generated objects are not clipped at brush boundaries.
- An in-memory LRU cache (`createMemoryAreaEditCache`) can deduplicate identical prompt + image + mask requests within a session.

See [docs/area-edit-backend.md](docs/area-edit-backend.md) for the full API reference.

### Library and persistence

| Storage | Contents |
| --- | --- |
| React state | Current image, history stack, editor mode, processing status |
| `sessionStorage` / in-memory | Editor session (cleared on full page reload unless restored from library) |
| `localStorage` (`kiezvision_library`) | Library entry metadata (prompt, timestamp, on-disk paths) |
| IndexedDB (`kiezvision-fs`) | Persisted `FileSystemDirectoryHandle` for the chosen library folder |
| User folder (Chromium) | Full-resolution PNG + JPEG thumbnail per saved vision |

Saving requires a Chromium-based browser with File System Access API support. Without a connected folder, library entries may fall back to inline data URLs.

### Internationalization

UI strings are defined inline in `App.tsx` for English and German. Language selection affects geocoding locale, error messages, and all visible labels.

---

## Project structure

```
KiezVision/
├── App.tsx                      # Application shell, routing, editor orchestration
├── areaEdit/                    # Masked inpainting domain layer
│   ├── pipeline/runAreaEdit.ts
│   ├── providers/geminiAreaEditProvider.ts
│   ├── composite/compositePatch.ts
│   └── prompts/                 # Operation-specific prompt builders
├── components/
│   ├── InpaintCanvas.tsx        # Brush / eraser mask painting
│   ├── BeforeAfterSlider.tsx    # Compare mode viewer
│   ├── ImagerySelectionModal.tsx
│   ├── TransformationPanel.tsx  # Presets and custom prompt
│   └── QuickActions.tsx
├── services/
│   ├── geminiService.ts         # Gemini image generation and geocoding helpers
│   ├── mapillaryService.ts      # Mapillary + Nominatim integration
│   ├── presetRules.ts           # Preset prompt rules and scope locks
│   ├── libraryStorage.ts        # File System Access + IndexedDB
│   └── imageUtils.ts            # Data URL helpers, crop, resize
└── docs/
    └── area-edit-backend.md     # Area edit technical reference
```

---

## Development commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start Vite dev server on port 3000 (`host: 0.0.0.0`) |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |

Active development happens on feature branches and merges into `main` via pull request.

---

## Browser support

| Feature | Requirement |
| --- | --- |
| Core editor (search, transform, compare) | Modern browser with ES modules |
| Area edit (canvas mask) | Canvas 2D support |
| Save to disk folder | Chromium (Chrome, Edge, Brave, Arc) + File System Access API |
| Camera capture | HTTPS or `localhost`; `navigator.mediaDevices.getUserMedia` |

---

## Attribution

Developed by **Technologiestiftung Berlin** and **CityLAB Berlin**.

- Street imagery: [Mapillary](https://www.mapillary.com/) (open street-level photos)
- Geocoding: [OpenStreetMap Nominatim](https://nominatim.org/)
- Image generation: [Google Gemini](https://ai.google.dev/)
