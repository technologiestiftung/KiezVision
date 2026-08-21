import type { GenerateContentResponse } from "@google/genai";

async function readErrorMessage(response: Response): Promise<string> {
	try {
		const data = (await response.json()) as {
			message?: string;
			error?: string;
		};
		return data.message || data.error || `Request failed (${response.status})`;
	} catch {
		return `Request failed (${response.status})`;
	}
}

const apiFetchInit: RequestInit = {
	credentials: "same-origin",
};

export async function hasApiSession(): Promise<boolean> {
	const response = await fetch("/api/session", {
		...apiFetchInit,
		method: "GET",
	});
	return response.ok;
}

export async function ensureApiSession(password?: string): Promise<void> {
	const response = await fetch("/api/session", {
		...apiFetchInit,
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(password ? { password } : {}),
	});
	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}
}

export async function fetchApiStatus(): Promise<{
	gemini: boolean;
	mapillary: boolean;
}> {
	const response = await fetch("/api/status", apiFetchInit);
	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}
	return (await response.json()) as { gemini: boolean; mapillary: boolean };
}

export async function proxyGeminiGenerateContent(params: {
	model: string;
	contents: unknown;
	config?: unknown;
}): Promise<GenerateContentResponse> {
	const body = JSON.stringify(params);
	if (body.length > 3_800_000) {
		throw new Error(
			"Image payload is too large for the API proxy. Use a smaller photo or paint a smaller area.",
		);
	}
	const response = await fetch("/api/gemini", {
		...apiFetchInit,
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body,
	});
	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}
	return (await response.json()) as GenerateContentResponse;
}

export async function proxyMapillaryImages(params: {
	lat: number;
	lng: number;
	radius: number;
	limit: number;
}): Promise<Record<string, unknown>> {
	const qs = new URLSearchParams({
		lat: String(params.lat),
		lng: String(params.lng),
		radius: String(params.radius),
		limit: String(params.limit),
	});
	const response = await fetch(`/api/mapillary/images?${qs}`, apiFetchInit);
	if (!response.ok) {
		throw new Error(await readErrorMessage(response));
	}
	return (await response.json()) as Record<string, unknown>;
}

export function mapillaryImageProxyUrl(imageUrl: string): string {
	return `/api/mapillary/image?url=${encodeURIComponent(imageUrl)}`;
}
