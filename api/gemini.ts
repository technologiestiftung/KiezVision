import type { IncomingMessage, ServerResponse } from "node:http";
import {
	generateContentViaServer,
	type GeminiGenerateBody,
} from "../server/gemini.ts";
import {
	assertBodySize,
	assertProtectedApiRequest,
} from "../server/requestGuard.ts";

export const config = {
	maxDuration: 60,
};

async function readBody(req: IncomingMessage): Promise<string> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
	}
	return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(
	req: IncomingMessage & { method?: string; body?: unknown },
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
	if (req.method !== "POST") {
		res.status(405).json({ message: "Method not allowed" });
		return;
	}

	try {
		assertProtectedApiRequest(req);

		let raw: string;
		if (typeof req.body === "string") {
			raw = req.body;
		} else if (req.body !== undefined) {
			raw = JSON.stringify(req.body);
		} else {
			raw = await readBody(req);
		}
		assertBodySize(Buffer.byteLength(raw, "utf8"));

		const body = JSON.parse(raw || "{}") as GeminiGenerateBody;
		const result = await generateContentViaServer(body);
		res.setHeader("Cache-Control", "no-store");
		res.status(200).json(result);
	} catch (error) {
		console.error("[api/gemini]", error);
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
