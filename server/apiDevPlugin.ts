import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "vite";
import {
	generateContentViaServer,
	geminiConfigured,
	type GeminiGenerateBody,
} from "./gemini.ts";
import {
	fetchMapillaryImageBytes,
	fetchMapillaryImages,
	mapillaryConfigured,
} from "./mapillary.ts";
import {
	assertAllowedOrigin,
	assertBodySize,
	assertProtectedApiRequest,
	assertValidSession,
	buildSessionCookie,
	createSessionToken,
	isSitePasswordRequired,
	verifySitePassword,
} from "./requestGuard.ts";

type ConnectReq = IncomingMessage & { url?: string; method?: string };
type ConnectRes = ServerResponse;

async function readRequestBody(req: ConnectReq): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}

function sendJson(res: ConnectRes, status: number, data: unknown): void {
	res.statusCode = status;
	res.setHeader("Content-Type", "application/json");
	res.setHeader("Cache-Control", "no-store");
	res.end(JSON.stringify(data));
}

function sendError(res: ConnectRes, error: unknown): void {
	const status =
		typeof error === "object" &&
		error !== null &&
		"status" in error &&
		typeof (error as { status: unknown }).status === "number"
			? (error as { status: number }).status
			: 500;
	const message =
		error instanceof Error ? error.message : "Internal server error";
	console.error("[api-dev]", error);
	sendJson(res, status, { error: message, message });
}

async function handleStatus(res: ConnectRes): Promise<void> {
	sendJson(res, 200, {
		gemini: geminiConfigured(),
		mapillary: mapillaryConfigured(),
	});
}

async function handleSession(req: ConnectReq, res: ConnectRes): Promise<void> {
	const method = req.method ?? "GET";
	if (method === "GET") {
		assertAllowedOrigin(req);
		assertValidSession(req);
		sendJson(res, 200, { ok: true });
		return;
	}
	assertAllowedOrigin(req);
	const raw = await readRequestBody(req);
	const password = raw
		? String((JSON.parse(raw) as { password?: string }).password ?? "")
		: "";
	if (isSitePasswordRequired() && !verifySitePassword(password)) {
		sendJson(res, 401, { message: "Invalid password" });
		return;
	}
	res.setHeader("Set-Cookie", buildSessionCookie(createSessionToken()));
	sendJson(res, 200, { ok: true });
}

async function handleGemini(req: ConnectReq, res: ConnectRes): Promise<void> {
	assertProtectedApiRequest(req);
	const raw = (await readRequestBody(req)) || "{}";
	assertBodySize(Buffer.byteLength(raw, "utf8"));
	const body = JSON.parse(raw) as GeminiGenerateBody;
	const result = await generateContentViaServer(body);
	sendJson(res, 200, result);
}

async function handleMapillaryImages(
	req: ConnectReq,
	rawUrl: string,
	res: ConnectRes,
): Promise<void> {
	assertProtectedApiRequest(req);
	const url = new URL(rawUrl, "http://localhost");
	const data = await fetchMapillaryImages({
		lat: Number(url.searchParams.get("lat")),
		lng: Number(url.searchParams.get("lng")),
		radius: Number(url.searchParams.get("radius") ?? "50"),
		limit: Number(url.searchParams.get("limit") ?? "12"),
	});
	sendJson(res, 200, data);
}

async function handleMapillaryImage(
	req: ConnectReq,
	rawUrl: string,
	res: ConnectRes,
): Promise<void> {
	assertProtectedApiRequest(req);
	const url = new URL(rawUrl, "http://localhost");
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
}

export function apiDevPlugin(mode: string): Plugin {
	return {
		name: "kiezvision-api-dev",
		configureServer(viteServer) {
			const env = loadEnv(mode, process.cwd(), "");
			for (const [key, value] of Object.entries(env)) {
				if (process.env[key] === undefined) {
					process.env[key] = value;
				}
			}

			viteServer.middlewares.use((req, res, next) => {
				void (async () => {
					try {
						const rawUrl = req.url ?? "/";
						const pathOnly = rawUrl.split("?")[0] ?? rawUrl;
						const method = req.method ?? "GET";

						if (pathOnly === "/api/status" && method === "GET") {
							await handleStatus(res);
							return;
						}
						if (pathOnly === "/api/session" && (method === "POST" || method === "GET")) {
							await handleSession(req, res);
							return;
						}
						if (pathOnly === "/api/gemini" && method === "POST") {
							await handleGemini(req, res);
							return;
						}
						if (pathOnly === "/api/mapillary/images" && method === "GET") {
							await handleMapillaryImages(req, rawUrl, res);
							return;
						}
						if (pathOnly === "/api/mapillary/image" && method === "GET") {
							await handleMapillaryImage(req, rawUrl, res);
							return;
						}
						next();
					} catch (error) {
						sendError(res, error);
					}
				})();
			});
		},
	};
}
