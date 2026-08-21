import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchMapillaryImageBytes } from "../../server/mapillary.ts";
import { assertProtectedApiRequest } from "../../server/requestGuard.ts";

export const config = {
	maxDuration: 30,
};

export default async function handler(
	req: IncomingMessage & { method?: string; url?: string },
	res: ServerResponse & {
		status: (code: number) => typeof res;
		json: (body: unknown) => void;
		send: (body: Buffer) => void;
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
		const imageUrl = url.searchParams.get("url");
		if (!imageUrl) {
			res.status(400).json({ message: "Missing url parameter" });
			return;
		}
		const { body, contentType } = await fetchMapillaryImageBytes(imageUrl);
		res.statusCode = 200;
		res.setHeader("Content-Type", contentType);
		res.setHeader("Cache-Control", "private, max-age=3600");
		res.end(Buffer.from(body));
	} catch (error) {
		console.error("[api/mapillary/image]", error);
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
