import type { IncomingMessage, ServerResponse } from "node:http";
import { sendError, sendJson } from "../../server/httpHelpers.ts";
import { fetchMapillaryImages } from "../../server/mapillary.ts";
import { assertProtectedApiRequest } from "../../server/requestGuard.ts";

export const config = {
	maxDuration: 30,
};

export default async function handler(
	req: IncomingMessage,
	res: ServerResponse,
): Promise<void> {
	try {
		if (req.method === "OPTIONS") {
			res.statusCode = 204;
			res.end();
			return;
		}
		if (req.method !== "GET") {
			sendJson(res, 405, { message: "Method not allowed" });
			return;
		}

		assertProtectedApiRequest(req);
		const url = new URL(req.url ?? "/", "http://localhost");
		const data = await fetchMapillaryImages({
			lat: Number(url.searchParams.get("lat")),
			lng: Number(url.searchParams.get("lng")),
			radius: Number(url.searchParams.get("radius") ?? "50"),
			limit: Number(url.searchParams.get("limit") ?? "12"),
		});
		sendJson(res, 200, data);
	} catch (error) {
		console.error("[api/mapillary/images]", error);
		sendError(res, error);
	}
}
