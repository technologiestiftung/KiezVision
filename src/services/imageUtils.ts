import { mapillaryImageProxyUrl } from "../lib/api.ts";

/** Normalised crop rectangle (0–1 relative to image dimensions). */
export interface NormalizedCrop {
	x: number;
	y: number;
	w: number;
	h: number;
}

/**
 * Fetches remote images into a data URL so canvas read/export and Gemini inlineData work
 * without CORS taint (Mapillary CDN URLs often block anonymous fetch).
 */
export async function toDisplayableDataUrl(source: string): Promise<string> {
	if (source.startsWith("data:")) return source;

	const attempts: (() => Promise<Blob>)[] = [
		() => fetch(source, { mode: "cors" }).then(assertOkBlob),
		() => fetchViaMapillaryProxy(source),
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
		`${msg}. If this is a Mapillary photo, check MAPILLARY_ACCESS_TOKEN on the server or upload the image instead.`,
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

/** Authenticated Mapillary fetch via same-origin proxy. */
async function fetchViaMapillaryProxy(url: string): Promise<Blob> {
	if (!/mapillary|fbcdn\.net/i.test(url)) {
		throw new Error("Not a Mapillary URL");
	}
	return assertOkBlob(
		await fetch(mapillaryImageProxyUrl(url), { credentials: "same-origin" }),
	);
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

export async function compressImageForApiProxy(
	dataUrl: string,
	options?: { maxDim?: number; quality?: number },
): Promise<{ mimeType: string; base64: string; dataUrl: string }> {
	const maxDim = options?.maxDim ?? 1024;
	const quality = options?.quality ?? 0.82;
	const img = await loadImageElement(dataUrl);
	const w = img.naturalWidth;
	const h = img.naturalHeight;
	const scale =
		w && h ? Math.min(1, maxDim / Math.max(w, h)) : 1;
	const nw = Math.max(1, Math.round((w || 1) * scale));
	const nh = Math.max(1, Math.round((h || 1) * scale));
	const canvas = document.createElement("canvas");
	canvas.width = nw;
	canvas.height = nh;
	const ctx = canvas.getContext("2d");
	if (!ctx) {
		const m = dataUrl.match(/^data:(image\/[^;]+);base64,(.+)$/);
		return {
			mimeType: m?.[1] ?? "image/jpeg",
			base64: m?.[2] ?? dataUrl,
			dataUrl,
		};
	}
	applyHighQualityCanvasScale(ctx);
	ctx.drawImage(img, 0, 0, nw, nh);
	const out = canvas.toDataURL("image/jpeg", quality);
	const m = out.match(/^data:(image\/[^;]+);base64,(.+)$/);
	return {
		mimeType: m?.[1] ?? "image/jpeg",
		base64: m?.[2] ?? "",
		dataUrl: out,
	};
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

/** Extract a sub-region; pass full frame as x:0,y:0,w:1,h:1 to skip cropping. */
export async function cropDataUrl(
	dataUrl: string,
	crop: NormalizedCrop,
): Promise<string> {
	if (crop.w >= 0.99 && crop.h >= 0.99 && crop.x <= 0.01 && crop.y <= 0.01) {
		return dataUrl;
	}
	const img = await loadImageElement(dataUrl);
	const x = Math.round(Math.max(0, crop.x) * img.naturalWidth);
	const y = Math.round(Math.max(0, crop.y) * img.naturalHeight);
	const w = Math.max(1, Math.round(crop.w * img.naturalWidth));
	const h = Math.max(1, Math.round(crop.h * img.naturalHeight));
	const canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;
	const ctx = canvas.getContext("2d");
	if (!ctx) return dataUrl;
	applyHighQualityCanvasScale(ctx);
	ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
	return canvas.toDataURL("image/png");
}
