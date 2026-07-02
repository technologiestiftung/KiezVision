export type AreaEditErrorCode =
	| "INVALID_INPUT"
	| "MASK_GEOMETRY"
	| "MASK_COVERAGE"
	| "IMAGE_LOAD"
	| "COMPOSITE"
	| "UPSTREAM"
	| "INTEGRITY";

export class AreaEditError extends Error {
	readonly code: AreaEditErrorCode;
	readonly cause?: unknown;

	constructor(message: string, code: AreaEditErrorCode, cause?: unknown) {
		super(message);
		this.name = "AreaEditError";
		this.code = code;
		this.cause = cause;
	}
}

export function isAreaEditError(e: unknown): e is AreaEditError {
	return e instanceof AreaEditError;
}
