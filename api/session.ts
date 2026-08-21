import type { IncomingMessage, ServerResponse } from "node:http";
import {
	assertAllowedOrigin,
	assertValidSession,
	buildSessionCookie,
	createSessionToken,
	isSitePasswordRequired,
	verifySitePassword,
} from "../server/requestGuard.ts";

type ApiReq = IncomingMessage & { method?: string; body?: unknown };
type ApiRes = ServerResponse & {
	status: (code: number) => ApiRes;
	json: (body: unknown) => void;
	setHeader: (name: string, value: string) => void;
};

async function readPassword(req: ApiReq): Promise<string> {
	if (typeof req.body === "object" && req.body !== null) {
		return String((req.body as { password?: string }).password ?? "");
	}
	if (typeof req.body === "string" && req.body) {
		return String(
			(JSON.parse(req.body) as { password?: string }).password ?? "",
		);
	}
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	const raw = Buffer.concat(chunks).toString("utf8");
	if (!raw) return "";
	return String((JSON.parse(raw) as { password?: string }).password ?? "");
}

function sendError(res: ApiRes, error: unknown, fallback = 500): void {
	const status =
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as { status: unknown }).status === "number"
			? (error as { status: number }).status
			: fallback;
	const message =
		error instanceof Error ? error.message : "Internal server error";
	res.status(status).json({ error: message, message });
}

export default async function handler(req: ApiReq, res: ApiRes): Promise<void> {
	if (req.method === "OPTIONS") {
		res.statusCode = 204;
		res.end();
		return;
	}

	if (req.method === "GET") {
		try {
			assertAllowedOrigin(req);
			assertValidSession(req);
			res.setHeader("Cache-Control", "no-store");
			res.status(200).json({ ok: true });
		} catch {
			res.status(401).json({ ok: false });
		}
		return;
	}

	if (req.method !== "POST") {
		res.status(405).json({ message: "Method not allowed" });
		return;
	}

	try {
		assertAllowedOrigin(req);
		const password = await readPassword(req);
		if (isSitePasswordRequired() && !verifySitePassword(password)) {
			res.status(401).json({ message: "Invalid password" });
			return;
		}
		res.setHeader("Set-Cookie", buildSessionCookie(createSessionToken()));
		res.setHeader("Cache-Control", "no-store");
		res.status(200).json({ ok: true });
	} catch (error) {
		console.error("[api/session]", error);
		sendError(res, error);
	}
}
