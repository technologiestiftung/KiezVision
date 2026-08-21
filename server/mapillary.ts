import { resolveMapillaryAccessToken } from "./secrets.ts";

const MAPILLARY_FIELDS =
	"id,thumb_1024_url,captured_at,compass_angle,geometry,is_pano";

export function mapillaryConfigured(): boolean {
	return Boolean(resolveMapillaryAccessToken());
}

export async function fetchMapillaryImages(params: {
	lat: number;
	lng: number;
	radius: number;
	limit: number;
}): Promise<unknown> {
	const token = resolveMapillaryAccessToken();
	if (!token) {
		throw Object.assign(
			new Error("MAPILLARY_ACCESS_TOKEN is not configured on the server."),
			{ status: 503 },
		);
	}

	const { lat, lng, radius, limit } = params;
	if (
		!Number.isFinite(lat) ||
		!Number.isFinite(lng) ||
		!Number.isFinite(radius) ||
		!Number.isFinite(limit)
	) {
		throw Object.assign(new Error("Invalid lat/lng/radius/limit."), {
			status: 400,
		});
	}

	const url = new URL("https://graph.mapillary.com/images");
	url.searchParams.set("access_token", token);
	url.searchParams.set("fields", MAPILLARY_FIELDS);
	url.searchParams.set("lat", String(lat));
	url.searchParams.set("lng", String(lng));
	url.searchParams.set("radius", String(Math.min(Math.max(radius, 1), 100)));
	url.searchParams.set("is_pano", "false");
	url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 100)));

	const response = await fetch(url);
	const data = (await response.json()) as Record<string, unknown>;
	if (!response.ok) {
		const err = data.error as { message?: string } | undefined;
		throw Object.assign(
			new Error(err?.message ?? `Mapillary HTTP ${response.status}`),
			{ status: response.status },
		);
	}
	return data;
}

export function isAllowedMapillaryImageUrl(raw: string): boolean {
	try {
		const u = new URL(raw);
		if (u.protocol !== "https:") return false;
		const host = u.hostname.toLowerCase();
		return (
			host === "mapillary.com" ||
			host.endsWith(".mapillary.com") ||
			host.endsWith(".fbcdn.net") ||
			host.endsWith(".facebook.com")
		);
	} catch {
		return false;
	}
}

export async function fetchMapillaryImageBytes(
	imageUrl: string,
): Promise<{ body: ArrayBuffer; contentType: string }> {
	const token = resolveMapillaryAccessToken();
	if (!token) {
		throw Object.assign(
			new Error("MAPILLARY_ACCESS_TOKEN is not configured on the server."),
			{ status: 503 },
		);
	}
	if (!isAllowedMapillaryImageUrl(imageUrl)) {
		throw Object.assign(new Error("URL host is not allowed."), { status: 400 });
	}

	const sep = imageUrl.includes("?") ? "&" : "?";
	const authed = `${imageUrl}${sep}access_token=${encodeURIComponent(token)}`;
	const response = await fetch(authed);
	if (!response.ok) {
		throw Object.assign(
			new Error(`Could not load image (${response.status})`),
			{ status: response.status },
		);
	}
	const contentType =
		response.headers.get("content-type") || "application/octet-stream";
	return { body: await response.arrayBuffer(), contentType };
}
