import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchMapillaryImages } from "../../server/mapillary.ts";
import { assertProtectedApiRequest } from "../../server/requestGuard.ts";

export const config = {
	maxDuration: 30,
};

export default async function handler(
	req: IncomingMessage & {
		method?: string;
		query?: Record<string, string | string[]>;
		url?: string;
	},
	res: ServerResponse & {
		status: (code: number) => typeof res;
		json: (body: unknown) => void;
	},
): Promise<void> {
	if (req.method === "OPTIONS") {
		res.statusCode = 204;
		res.end();
		return;
	}
	if (req.method !== "GET") {
		res.status(405).json({ message: "Method not allowed" });
		return;
	}

	try {
		assertProtectedApiRequest(req);
		const url = new URL(req.url ?? "/", "http://localhost");
		const lat = Number(url.searchParams.get("lat"));
		const lng = Number(url.searchParams.get("lng"));
		const radius = Number(url.searchParams.get("radius") ?? "50");
		const limit = Number(url.searchParams.get("limit") ?? "12");
		const data = await fetchMapillaryImages({ lat, lng, radius, limit });
		res.setHeader("Cache-Control", "no-store");
		res.status(200).json(data);
	} catch (error) {
		console.error("[api/mapillary/images]", error);
		const status =
			typeof error === "object" &&
			error !== null &&
			"status" in error &&
			typeof (error as { status: unknown }).status === "number"
				? (error as { status: number }).status
				: 500;
		const message =
			error instanceof Error ? error.message : "Internal server error";
		res.status(status).json({ error: message, message });
	}
}
