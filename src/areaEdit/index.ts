/**
 * Area-edit domain layer: constrained generation + CPU compositing guarantees.
 */

export type {
	AreaEditOperation,
	AreaSelection,
	AreaEditRequest,
	AreaEditResult,
	AreaEditRunMeta,
	AreaEditGenerateOptions,
	AreaEditModelProvider,
	AreaEditCache,
	AreaEditIntegrityReport,
	GeminiAspectRatio,
	MaskCompositeOptions,
} from "./types";

export { runAreaEdit, type RunAreaEditContext } from "./pipeline/runAreaEdit";
export {
	createMemoryAreaEditCache,
	type MemoryCacheOptions,
} from "./cache/memoryCache";
export {
	AreaEditError,
	isAreaEditError,
	type AreaEditErrorCode,
} from "./errors";
export { buildAreaEditInstruction } from "./prompts/buildOperationPrompt";
export {
	inferGeminiAspectRatioFromImage,
	inferGeminiAspectRatioFromDimensions,
} from "./util/aspectRatio";
