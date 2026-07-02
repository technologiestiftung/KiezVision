import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from "react";
import type { NavigateFunction } from "react-router-dom";
import type { ContentStrings } from "../content.ts";
import type { Language } from "../content.ts";
import {
	transformImage,
	type GeminiImageAspectRatio,
} from "../services/geminiService.ts";
import { buildTransformPrompt } from "../services/presetRules.ts";
import { runAreaEdit } from "../areaEdit/index.ts";
import { toDisplayableDataUrl } from "../services/imageUtils.ts";
import type { GeneratedImage, ProcessingState } from "../types.ts";

export type EditMode = "comparison" | "mask";

export type InpaintCanvasHandle = {
	clear: () => void;
	getMaskDataUrl: () => string | null;
	hasMaskPaint: () => boolean;
};

export interface UseEditorOptions {
	language: Language;
	content: ContentStrings;
	navigate: NavigateFunction;
	setError: (error: string | null) => void;
	setProcessing: (state: ProcessingState) => void;
	setHasApiKey: (hasKey: boolean) => void;
	highQuality?: boolean;
}

function isQuotaError(err: unknown): boolean {
	const message = err instanceof Error ? err.message : String(err);
	return (
		message.toLowerCase().includes("429") ||
		message.toLowerCase().includes("quota") ||
		JSON.stringify(err).includes("429")
	);
}

function isPermissionError(err: unknown): boolean {
	const message = err instanceof Error ? err.message : String(err);
	return (
		message.toLowerCase().includes("403") ||
		message.toLowerCase().includes("permission denied") ||
		JSON.stringify(err).includes("403")
	);
}

async function resolveMaskForEdit(options: {
	editMode: EditMode;
	canvasRef: RefObject<InpaintCanvasHandle | null>;
	maskBase64: string | null;
	language: Language;
	setError: (error: string | null) => void;
}): Promise<string | null> {
	const { editMode, canvasRef, maskBase64, language, setError } = options;
	if (editMode !== "mask") return null;

	const hasPaint = canvasRef.current?.hasMaskPaint?.() ?? false;
	if (!hasPaint) {
		setError(
			language === "en"
				? "Paint an area on the image first (Area Edit brush)."
				: "Bitte zuerst einen Bereich mit dem Pinsel markieren (Bereich bearbeiten).",
		);
		return null;
	}

	const maskForRun = canvasRef.current?.getMaskDataUrl?.() ?? maskBase64;
	if (!maskForRun) {
		setError(
			language === "en"
				? "Could not read the brush mask. Paint again or reload the image."
				: "Pinselmaske konnte nicht gelesen werden. Bitte erneut malen oder Bild neu laden.",
		);
		return null;
	}
	return maskForRun;
}

async function runMaskedAreaEdit(options: {
	imageForRun: string;
	maskForRun: string;
	prompt: string;
	highQuality: boolean;
	language: Language;
	setError: (error: string | null) => void;
}): Promise<string> {
	const { imageForRun, maskForRun, prompt, highQuality, language, setError } =
		options;
	try {
		const areaResult = await runAreaEdit({
			originalImageUrl: imageForRun,
			selection: { kind: "raster", dataUrl: maskForRun },
			prompt,
			options: {
				highQuality,
				modelTemperature: 0.4,
			},
		});
		return areaResult.dataUrl;
	} catch (areaErr: unknown) {
		const msg = areaErr instanceof Error ? areaErr.message : String(areaErr);
		if (msg.includes("MASK_GEOMETRY") || msg.includes("does not match")) {
			setError(
				language === "en"
					? "Brush mask does not match the image size. Clear the mask and paint again."
					: "Pinselmaske passt nicht zur Bildgröße. Maske löschen und erneut malen.",
			);
			return "";
		}
		throw areaErr;
	}
}

export function useEditor({
	language,
	content,
	navigate,
	setError,
	setProcessing,
	setHasApiKey,
	highQuality = false,
}: UseEditorOptions) {
	const [originalImage, setOriginalImage] = useState<string | null>(null);
	const [currentImage, setCurrentImage] = useState<string | null>(null);
	const [history, setHistory] = useState<GeneratedImage[]>([]);
	const [editMode, setEditMode] = useState<EditMode>("comparison");
	const [maskBase64, setMaskBase64] = useState<string | null>(null);
	const [brushSize, setBrushSize] = useState(40);
	const [inpaintMountKey, setInpaintMountKey] = useState(0);
	const [isAreaEditEraser, setIsAreaEditEraser] = useState(false);
	const [imageSource, setImageSource] = useState<string | null>(null);
	const [fetchedLocation, setFetchedLocation] = useState<string | null>(null);
	const [mapillaryMetadata, setMapillaryMetadata] = useState<{
		link: string;
		capturedAt?: string;
	} | null>(null);
	const [lastExportedImage, setLastExportedImage] = useState<string | null>(
		null,
	);
	const [showLeaveEditorConfirm, setShowLeaveEditorConfirm] = useState(false);
	const [pendingPathAfterLeaveConfirm, setPendingPathAfterLeaveConfirm] =
		useState<string | null>(null);

	const canvasRef = useRef<InpaintCanvasHandle | null>(null);
	const leaveDialogRef = useRef<HTMLDivElement>(null);

	const loadImageIntoEditor = useCallback(
		(dataUrl: string, prompt: string) => {
			setOriginalImage(dataUrl);
			setCurrentImage(dataUrl);
			setError(null);
			setHistory([{ id: "original", dataUrl, prompt, timestamp: Date.now() }]);
			setEditMode("comparison");
			setLastExportedImage(null);
			navigate("/edit");
		},
		[navigate, setError],
	);

	const loadFromLibraryEntry = useCallback(
		(dataUrl: string, prompt: string, timestamp: number) => {
			setOriginalImage(dataUrl);
			setCurrentImage(dataUrl);
			setHistory([{ id: "original", dataUrl, prompt, timestamp }]);
			setEditMode("comparison");
			setLastExportedImage(null);
			navigate("/edit");
		},
		[navigate],
	);

	const hasUnexportedChanges = useMemo(() => {
		if (!currentImage) return false;
		return currentImage !== lastExportedImage;
	}, [currentImage, lastExportedImage]);

	const requestLeaveEditor = useCallback(
		(path: string) => {
			if (hasUnexportedChanges) {
				setPendingPathAfterLeaveConfirm(path);
				setShowLeaveEditorConfirm(true);
				return;
			}
			navigate(path);
		},
		[hasUnexportedChanges, navigate],
	);

	const confirmLeaveEditor = useCallback(() => {
		const next = pendingPathAfterLeaveConfirm || "/";
		setShowLeaveEditorConfirm(false);
		setPendingPathAfterLeaveConfirm(null);
		navigate(next);
	}, [navigate, pendingPathAfterLeaveConfirm]);

	const cancelLeaveEditor = useCallback(() => {
		setShowLeaveEditorConfirm(false);
		setPendingPathAfterLeaveConfirm(null);
	}, []);

	const markImageExported = useCallback((dataUrl: string) => {
		setLastExportedImage(dataUrl);
	}, []);

	useEffect(() => {
		setIsAreaEditEraser(false);
	}, [inpaintMountKey]);

	useEffect(() => {
		if (
			editMode !== "mask" ||
			!currentImage ||
			currentImage.startsWith("data:")
		) {
			return undefined;
		}
		let cancelled = false;
		void (async () => {
			try {
				const dataUrl = await toDisplayableDataUrl(currentImage);
				if (cancelled || dataUrl === currentImage) return;
				setCurrentImage(dataUrl);
				if (originalImage === currentImage) {
					setOriginalImage(dataUrl);
				}
				setInpaintMountKey((k) => k + 1);
			} catch {
				if (!cancelled) {
					setError(
						language === "en"
							? "Could not prepare this photo for area edit. Upload the image or search again."
							: "Foto konnte nicht für Bereich bearbeiten vorbereitet werden. Bitte Bild hochladen oder erneut suchen.",
					);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [editMode, currentImage, originalImage, language, setError]);

	const getBestAspectRatio = (
		imgUrl: string,
	): Promise<GeminiImageAspectRatio> => {
		const targets: { label: GeminiImageAspectRatio; r: number }[] = [
			{ label: "21:9", r: 21 / 9 },
			{ label: "16:9", r: 16 / 9 },
			{ label: "3:2", r: 3 / 2 },
			{ label: "4:3", r: 4 / 3 },
			{ label: "1:1", r: 1 },
			{ label: "3:4", r: 3 / 4 },
			{ label: "2:3", r: 2 / 3 },
			{ label: "9:16", r: 9 / 16 },
		];
		return new Promise((resolve) => {
			const img = new Image();
			img.onload = () => {
				const ratio = img.width / img.height;
				let best: GeminiImageAspectRatio = "4:3";
				let bestScore = Infinity;
				for (const { label, r } of targets) {
					const score = Math.abs(Math.log(ratio / r));
					if (score < bestScore) {
						bestScore = score;
						best = label;
					}
				}
				resolve(best);
			};
			img.onerror = () => resolve("16:9");
			img.src = imgUrl;
		});
	};

	const handleTransform = useCallback(
		async (prompt: string) => {
			if (!currentImage) return;

			setProcessing({
				isProcessing: true,
				statusMessage:
					language === "en"
						? "Synthesizing changes..."
						: "Änderungen werden synthetisiert...",
			});
			setError(null);

			try {
				const imageForRun = await toDisplayableDataUrl(currentImage);
				if (imageForRun !== currentImage) {
					setCurrentImage(imageForRun);
					if (originalImage === currentImage) {
						setOriginalImage(imageForRun);
					}
				}

				const maskForRun = await resolveMaskForEdit({
					editMode,
					canvasRef,
					maskBase64,
					language,
					setError,
				});
				if (editMode === "mask" && !maskForRun) return;

				let finalImageData: string;
				if (maskForRun) {
					finalImageData = await runMaskedAreaEdit({
						imageForRun,
						maskForRun,
						prompt,
						highQuality,
						language,
						setError,
					});
					if (!finalImageData) return;
				} else {
					const aspectRatio = await getBestAspectRatio(imageForRun);
					const finalPrompt = buildTransformPrompt(prompt, { editMode });
					finalImageData = await transformImage({
						imageBase64: imageForRun,
						prompt: finalPrompt,
						highQuality,
						aspectRatio,
					});
				}

				const label = editMode === "mask" ? "Area" : "Full";
				const newImageEntry: GeneratedImage = {
					id: Date.now().toString(),
					dataUrl: finalImageData,
					prompt: editMode !== "comparison" ? `${label}: ${prompt}` : prompt,
					timestamp: Date.now(),
				};

				setHistory((prev) => [newImageEntry, ...prev]);
				setCurrentImage(finalImageData);

				if (maskForRun) {
					canvasRef.current?.clear();
					setMaskBase64(null);
					setInpaintMountKey((k) => k + 1);
				} else {
					setEditMode("comparison");
					setMaskBase64(null);
				}
			} catch (err: unknown) {
				if (isQuotaError(err)) {
					setError(content.errorQuotaExceeded);
				} else if (isPermissionError(err)) {
					setError(content.errorPermissionDenied);
					setHasApiKey(false);
				} else {
					const message = err instanceof Error ? err.message : String(err);
					setError(message || content.errorFailedTransform);
				}
			} finally {
				setProcessing({ isProcessing: false });
			}
		},
		[
			currentImage,
			editMode,
			highQuality,
			language,
			maskBase64,
			originalImage,
			setError,
			setHasApiKey,
			setProcessing,
			content.errorFailedTransform,
			content.errorPermissionDenied,
			content.errorQuotaExceeded,
		],
	);

	const handleOverlayChange = useCallback((data: { mask?: string } | null) => {
		if (!data?.mask) {
			setMaskBase64(null);
		} else {
			setMaskBase64(data.mask);
		}
	}, []);

	const enterMaskMode = useCallback(() => {
		setInpaintMountKey((k) => k + 1);
		setEditMode("mask");
	}, []);

	const setImageryContext = useCallback(
		(ctx: {
			sourceLabel: string;
			displayLocation: string;
			mapillaryMeta: { link: string; capturedAt?: string } | null;
		}) => {
			setImageSource(ctx.sourceLabel);
			setFetchedLocation(ctx.displayLocation);
			setMapillaryMetadata(ctx.mapillaryMeta);
		},
		[],
	);

	const resetEditorFromImagery = useCallback(
		(imageData: string, sourceLabel: string, displayLocation: string) => {
			setOriginalImage(imageData);
			setCurrentImage(imageData);
			setHistory([
				{
					id: Date.now().toString(),
					dataUrl: imageData,
					prompt: `${sourceLabel}: ${displayLocation}`,
					timestamp: Date.now(),
				},
			]);
			setEditMode("comparison");
			setMaskBase64(null);
			setInpaintMountKey((k) => k + 1);
			setLastExportedImage(null);
		},
		[],
	);

	return {
		originalImage,
		currentImage,
		history,
		editMode,
		setEditMode,
		maskBase64,
		brushSize,
		setBrushSize,
		inpaintMountKey,
		isAreaEditEraser,
		setIsAreaEditEraser,
		imageSource,
		fetchedLocation,
		mapillaryMetadata,
		canvasRef: canvasRef as RefObject<InpaintCanvasHandle | null>,
		leaveDialogRef,
		showLeaveEditorConfirm,
		pendingPathAfterLeaveConfirm,
		hasUnexportedChanges,
		loadImageIntoEditor,
		loadFromLibraryEntry,
		requestLeaveEditor,
		confirmLeaveEditor,
		cancelLeaveEditor,
		markImageExported,
		handleTransform,
		handleOverlayChange,
		enterMaskMode,
		setImageryContext,
		resetEditorFromImagery,
		setCurrentImage,
		setFetchedLocation,
	};
}
