import type { IncomingMessage, ServerResponse } from "node:http";
import { sendError, sendJson } from "../../server/httpHelpers.ts";
import { fetchMapillaryImageBytes } from "../../server/mapillary.ts";
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
		const imageUrl = url.searchParams.get("url");
		if (!imageUrl) {
			sendJson(res, 400, { message: "Missing url parameter" });
			return;
		}
		const { body, contentType } = await fetchMapillaryImageBytes(imageUrl);
		res.statusCode = 200;
		res.setHeader("Content-Type", contentType);
		res.setHeader("Cache-Control", "private, max-age=3600");
		res.end(Buffer.from(body));
	} catch (error) {
		console.error("[api/mapillary/image]", error);
		sendError(res, error);
	}
}
