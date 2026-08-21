import type { IncomingMessage, ServerResponse } from "node:http";
import { sendError, sendJson } from "../server/httpHelpers.ts";
import { geminiConfigured, mapillaryConfigured } from "../server/secrets.ts";

export default function handler(
	req: IncomingMessage,
	res: ServerResponse,
): void {
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
		sendJson(res, 200, {
			gemini: geminiConfigured(),
			mapillary: mapillaryConfigured(),
		});
	} catch (error) {
		console.error("[api/status]", error);
		sendError(res, error);
	}
}
