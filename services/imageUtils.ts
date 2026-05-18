/**
 * Fetches remote images into a data URL so canvas read/export and Gemini inlineData work
 * without CORS taint (Mapillary CDN URLs often block anonymous fetch).
 */
export async function toDisplayableDataUrl(source: string): Promise<string> {
  if (source.startsWith("data:")) return source;

  const attempts: (() => Promise<Blob>)[] = [
    () => fetch(source, { mode: "cors" }).then(assertOkBlob),
    () => fetchWithMapillaryToken(source),
  ];

  let lastErr: unknown;
  for (const attempt of attempts) {
    try {
      const blob = await attempt();
      return await blobToDataUrl(blob);
    } catch (e) {
      lastErr = e;
    }
  }

  const msg =
    lastErr instanceof Error ? lastErr.message : "Could not load image";
  throw new Error(
    `${msg}. If this is a Mapillary photo, check MAPILLARY_ACCESS_TOKEN or upload the image instead.`,
  );
}

async function assertOkBlob(response: Response): Promise<Blob> {
  if (!response.ok) {
    throw new Error(`Could not load image (${response.status})`);
  }
  const blob = await response.blob();
  if (!blob.type.startsWith("image/") && blob.size === 0) {
    throw new Error("Empty image response");
  }
  return blob;
}

/** Mapillary CDN thumbs often need the app token appended for browser fetch. */
async function fetchWithMapillaryToken(url: string): Promise<Blob> {
  const token = process.env.MAPILLARY_ACCESS_TOKEN;
  if (!token) throw new Error("No Mapillary token");
  if (!/mapillary/i.test(url)) throw new Error("Not a Mapillary URL");

  const sep = url.includes("?") ? "&" : "?";
  const authed = `${url}${sep}access_token=${encodeURIComponent(token)}`;
  return assertOkBlob(await fetch(authed, { mode: "cors" }));
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read image blob"));
    };
    reader.onerror = () => reject(new Error("Failed to read image blob"));
    reader.readAsDataURL(blob);
  });
}

export function loadImageElement(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to decode image"));
    img.src = dataUrl;
  });
}

function applyHighQualityCanvasScale(ctx: CanvasRenderingContext2D): void {
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

/** Resize a data URL to exact pixel dimensions (for compositing after model output). */
export async function resizeDataUrlToDimensions(
  dataUrl: string,
  width: number,
  height: number,
): Promise<string> {
  if (!width || !height) return dataUrl;
  const img = await loadImageElement(dataUrl);
  if (img.naturalWidth === width && img.naturalHeight === height) {
    return dataUrl;
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  applyHighQualityCanvasScale(ctx);
  ctx.drawImage(img, 0, 0, width, height);
  return canvas.toDataURL("image/png");
}
