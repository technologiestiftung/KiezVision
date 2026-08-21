import type { IncomingMessage, ServerResponse } from "node:http";
import { readRawBody, sendError, sendJson } from "../server/httpHelpers.ts";
import {
	assertAllowedOrigin,
	assertValidSession,
	buildSessionCookie,
	createSessionToken,
	isSitePasswordRequired,
	verifySitePassword,
} from "../server/requestGuard.ts";

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

		if (req.method === "GET") {
			try {
				assertAllowedOrigin(req);
				assertValidSession(req);
				sendJson(res, 200, { ok: true });
			} catch {
				sendJson(res, 401, { ok: false });
			}
			return;
		}

		if (req.method !== "POST") {
			sendJson(res, 405, { message: "Method not allowed" });
			return;
		}

		assertAllowedOrigin(req);
		const raw = await readRawBody(req);
		const password = raw
			? String((JSON.parse(raw) as { password?: string }).password ?? "")
			: "";
		if (isSitePasswordRequired() && !verifySitePassword(password)) {
			sendJson(res, 401, { message: "Invalid password" });
			return;
		}
		res.setHeader("Set-Cookie", buildSessionCookie(createSessionToken()));
		sendJson(res, 200, { ok: true });
	} catch (error) {
		console.error("[api/session]", error);
		sendError(res, error);
	}
}
