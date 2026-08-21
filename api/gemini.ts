import type { IncomingMessage, ServerResponse } from "node:http";
import {
	generateContentViaServer,
	type GeminiGenerateBody,
} from "../server/gemini.ts";
import { readRawBody, sendError, sendJson } from "../server/httpHelpers.ts";
import {
	assertBodySize,
	assertProtectedApiRequest,
} from "../server/requestGuard.ts";

export const config = {
	maxDuration: 60,
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
		if (req.method !== "POST") {
			sendJson(res, 405, { message: "Method not allowed" });
			return;
		}

		assertProtectedApiRequest(req);
		const raw = await readRawBody(req);
		assertBodySize(Buffer.byteLength(raw || "{}", "utf8"));
		const body = JSON.parse(raw || "{}") as GeminiGenerateBody;
		const result = await generateContentViaServer(body);
		sendJson(res, 200, result);
	} catch (error) {
		console.error("[api/gemini]", error);
		sendError(res, error);
	}
}
