import React, {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type RefObject,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";
import heic2any from "heic2any";
import type { ImagerySelectionConfirmPayload } from "../components/imagery/imagery-selection-modal.tsx";
import {
	DEFAULT_IMAGERY_SEARCH_RADIUS_M,
	isPasswordProtectionActive,
} from "../constants.ts";
import {
	BERLIN_DISTRICT_SEARCH_RADIUS_M,
	isBerlinDistrict,
} from "../services/berlinDistricts.ts";
import { getContent, type ContentStrings, type Language } from "../content.ts";
import { getGeminiApiKey } from "../lib/env.ts";
import { useEditor } from "../hooks/use-editor.ts";
import { useFocusTrap } from "../hooks/use-focus-trap.ts";
import { useLibrary } from "../hooks/use-library.ts";
import { normalizePath } from "../routes/path-utils.ts";
import { cropDataUrl } from "../services/imageUtils.ts";
import { loadFullImageDataUrl } from "../services/libraryStorage.ts";
import {
	geocodeBerlin,
	fetchMapillaryCandidates,
	reverseGeocodeLocation,
	type GeocodeResult,
	type MapillaryCandidate,
} from "../services/mapillaryService.ts";
import { isGeminiQuotaError } from "../services/geminiService.ts";
import type {
	GeneratedImage,
	LibraryEntry,
	ProcessingState,
} from "../types.ts";

export interface AppContextValue {
	language: Language;
	setLanguage: (language: Language) => void;
	content: ContentStrings;
	processing: ProcessingState;
	error: string | null;
	setError: (error: string | null) => void;
	searchQuery: string;
	setSearchQuery: (query: string) => void;
	library: ReturnType<typeof useLibrary>;
	editor: ReturnType<typeof useEditor>;
	imageryPickerOpen: boolean;
	imageryPickerLocation: GeocodeResult | null;
	imageryPickerCandidates: MapillaryCandidate[];
	imageryPickerRadiusM: number;
	imageryPickerStrings: {
		title: string;
		subtitle: string;
		lat: string;
		lng: string;
		searchRadius: string;
		refresh: string;
		distance: string;
		noCandidates: string;
		confirm: string;
		cancel: string;
		openMapillary: string;
	};
	setImageryPickerOpen: (open: boolean) => void;
	handleImageryConfirm: (
		payload: ImagerySelectionConfirmPayload,
	) => Promise<void>;
	cameraOpen: boolean;
	cameraVideoRef: RefObject<HTMLVideoElement | null>;
	cameraModalRef: RefObject<HTMLDivElement | null>;
	cameraFileFallbackRef: RefObject<HTMLInputElement | null>;
	closeCamera: () => void;
	openDeviceCamera: () => Promise<void>;
	capturePhotoFromVideo: () => void;
	uploadedGallery: GeneratedImage[];
	selectedGalleryId: string | null;
	setSelectedGalleryId: (id: string | null) => void;
	handleSearch: (query: string) => Promise<void>;
	handleAutoDetect: () => Promise<void>;
	handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
	handleOpenLibraryEntry: (item: LibraryEntry) => Promise<void>;
	handleDownloadLibraryEntry: (item: LibraryEntry) => Promise<void>;
	handleSaveToLibrary: () => Promise<void>;
	handleDownloadCurrentImage: () => void;
	handleClearHistory: () => void;
	reopenImageryPicker: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
	const ctx = useContext(AppContext);
	if (!ctx) {
		throw new Error("useAppContext must be used within AppProvider");
	}
	return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
	const navigate = useNavigate();
	const location = useLocation();
	const lastNormalizedPathRef = useRef<string | null>(null);

	const [language, setLanguage] = useState<Language>("en");
	const content = getContent(language);
	const [processing, setProcessing] = useState<ProcessingState>({
		isProcessing: false,
	});
	const [error, setError] = useState<string | null>(null);
	const [, setHasApiKey] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");
	const [uploadedGallery, setUploadedGallery] = useState<GeneratedImage[]>([]);
	const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(
		null,
	);

	const [imageryPickerOpen, setImageryPickerOpen] = useState(false);
	const [imageryPickerLocation, setImageryPickerLocation] =
		useState<GeocodeResult | null>(null);
	const [imageryPickerCandidates, setImageryPickerCandidates] = useState<
		MapillaryCandidate[]
	>([]);
	const [imageryPickerRadiusM, setImageryPickerRadiusM] = useState(
		DEFAULT_IMAGERY_SEARCH_RADIUS_M,
	);
	const [lastImageryGeocode, setLastImageryGeocode] =
		useState<GeocodeResult | null>(null);

	const cameraVideoRef = useRef<HTMLVideoElement>(null);
	const cameraStreamRef = useRef<MediaStream | null>(null);
	const cameraFileFallbackRef = useRef<HTMLInputElement>(null);
	const cameraModalRef = useRef<HTMLDivElement>(null);
	const [cameraOpen, setCameraOpen] = useState(false);

	const library = useLibrary({ language, content, setError });
	const editor = useEditor({
		language,
		content,
		navigate,
		setError,
		setProcessing,
		setHasApiKey,
	});

	const normalizedPath = normalizePath(location.pathname);

	const imageryPickerStrings = useMemo(
		() => ({
			title: content.imageryPickerTitle,
			subtitle: content.imageryPickerSubtitle,
			lat: content.imageryLat,
			lng: content.imageryLng,
			searchRadius: content.imagerySearchRadius,
			refresh: content.imageryRefresh,
			distance: content.imageryDistance,
			noCandidates: content.imageryNoCandidates,
			confirm: content.imageryConfirm,
			cancel: content.imageryCancel,
			openMapillary: content.imageryOpenMapillary,
		}),
		[content],
	);

	useFocusTrap(
		editor.showLeaveEditorConfirm,
		editor.leaveDialogRef,
		editor.cancelLeaveEditor,
	);

	const stopCameraStream = useCallback(() => {
		cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
		cameraStreamRef.current = null;
		if (cameraVideoRef.current) {
			cameraVideoRef.current.srcObject = null;
		}
	}, []);

	const closeCamera = useCallback(() => {
		stopCameraStream();
		setCameraOpen(false);
	}, [stopCameraStream]);

	useFocusTrap(cameraOpen, cameraModalRef, closeCamera);

	const openDeviceCamera = useCallback(async () => {
		if (!navigator.mediaDevices?.getUserMedia) {
			cameraFileFallbackRef.current?.click();
			return;
		}
		const tryStream = async (constraints: MediaStreamConstraints) => {
			const s = await navigator.mediaDevices.getUserMedia(constraints);
			cameraStreamRef.current = s;
			setCameraOpen(true);
		};
		try {
			await tryStream({
				video: { facingMode: { ideal: "environment" } },
				audio: false,
			});
		} catch {
			try {
				await tryStream({ video: { facingMode: "user" }, audio: false });
			} catch {
				try {
					await tryStream({ video: true, audio: false });
				} catch {
					cameraFileFallbackRef.current?.click();
				}
			}
		}
	}, []);

	const capturePhotoFromVideo = useCallback(() => {
		const video = cameraVideoRef.current;
		if (!video || video.readyState < 2) return;
		const w = video.videoWidth;
		const h = video.videoHeight;
		if (!w || !h) return;
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;
		ctx.drawImage(video, 0, 0, w, h);
		const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
		closeCamera();
		editor.loadImageIntoEditor(
			dataUrl,
			language === "en" ? "Camera capture" : "Kameraaufnahme",
		);
	}, [closeCamera, editor, language]);

	useEffect(() => {
		if (!cameraOpen) return;
		const video = cameraVideoRef.current;
		const stream = cameraStreamRef.current;
		if (!video || !stream) return;
		video.srcObject = stream;
		video.setAttribute("playsinline", "true");
		video.play().catch(() => {});
	}, [cameraOpen]);

	useEffect(() => {
		return () => stopCameraStream();
	}, [stopCameraStream]);

	useEffect(() => {
		const checkKey = async () => {
			const envKey = getGeminiApiKey();
			if (envKey) {
				setHasApiKey(true);
				return;
			}
			if (window.aistudio) {
				const selected = await window.aistudio.hasSelectedApiKey();
				setHasApiKey(selected);
			} else {
				setHasApiKey(true);
			}
		};
		void checkKey();
	}, []);

	useEffect(() => {
		const prev = lastNormalizedPathRef.current;
		lastNormalizedPathRef.current = normalizedPath;
		if (!prev) return;
		if (
			prev === "/edit" &&
			normalizedPath !== "/edit" &&
			editor.hasUnexportedChanges
		) {
			editor.requestLeaveEditor(normalizedPath);
			navigate("/edit", { replace: true });
		}
	}, [
		editor.hasUnexportedChanges,
		editor.requestLeaveEditor,
		navigate,
		normalizedPath,
	]);

	useEffect(() => {
		document.documentElement.lang = language;
	}, [language]);

	const openImageryPicker = useCallback(
		async (
			geo: GeocodeResult,
			searchRadiusM = DEFAULT_IMAGERY_SEARCH_RADIUS_M,
		) => {
			setProcessing({
				isProcessing: true,
				statusMessage: content.fetchingStreet,
			});
			setError(null);
			try {
				const candidates = await fetchMapillaryCandidates(geo.lat, geo.lng, {
					searchRadiusM,
					limit: 12,
				});
				if (candidates.length === 0) {
					setError(content.imageryNoCandidates);
					return;
				}
				setImageryPickerLocation(geo);
				setImageryPickerCandidates(candidates);
				setImageryPickerRadiusM(searchRadiusM);
				setImageryPickerOpen(true);
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				if (/MAPILLARY_ACCESS_TOKEN/i.test(msg)) {
					setError(
						language === "en"
							? "Mapillary access token is missing. Add MAPILLARY_ACCESS_TOKEN to your .env file."
							: "Mapillary-Zugangstoken fehlt. MAPILLARY_ACCESS_TOKEN in der .env-Datei setzen.",
					);
				} else {
					setError(msg || content.errorFailedStreetImage);
				}
			} finally {
				setProcessing({ isProcessing: false });
			}
		},
		[
			content.fetchingStreet,
			content.imageryNoCandidates,
			content.errorFailedStreetImage,
			language,
		],
	);

	const handleImageryConfirm = useCallback(
		async (payload: ImagerySelectionConfirmPayload) => {
			setProcessing({ isProcessing: true, statusMessage: content.loading });
			setError(null);
			try {
				const imageData = await cropDataUrl(
					payload.previewDataUrl,
					payload.crop,
				);
				editor.resetEditorFromImagery(
					imageData,
					payload.sourceLabel,
					payload.displayLocation,
				);
				editor.setImageryContext({
					sourceLabel: payload.sourceLabel,
					displayLocation: payload.displayLocation,
					mapillaryMeta: payload.mapillaryMeta,
				});
				setLastImageryGeocode(payload.location);
				setSearchQuery(payload.displayLocation);
				editor.setFetchedLocation(payload.displayLocation);
				setImageryPickerOpen(false);
				if (normalizedPath !== "/edit") navigate("/edit");
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg || content.errorFailedStreetImage);
			} finally {
				setProcessing({ isProcessing: false });
			}
		},
		[
			editor,
			navigate,
			normalizedPath,
			content.errorFailedStreetImage,
			content.loading,
		],
	);

	const reopenImageryPicker = useCallback(async () => {
		let geo = lastImageryGeocode;
		if (!geo && (editor.fetchedLocation || searchQuery)) {
			geo = await geocodeBerlin(
				editor.fetchedLocation || searchQuery,
				language,
			);
		}
		if (!geo) {
			setError(
				language === "en"
					? "Search for a street first to change imagery."
					: "Suchen Sie zuerst eine Straße, um die Bildquelle zu ändern.",
			);
			return;
		}
		await openImageryPicker(geo);
	}, [
		editor.fetchedLocation,
		language,
		lastImageryGeocode,
		openImageryPicker,
		searchQuery,
	]);

	const getCurrentPosition = (): Promise<GeolocationPosition> =>
		new Promise((resolve, reject) => {
			if (!navigator.geolocation) {
				reject(new Error("GEOLOCATION_UNSUPPORTED"));
				return;
			}
			navigator.geolocation.getCurrentPosition(resolve, reject, {
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000,
			});
		});

	const handleAutoDetect = useCallback(async () => {
		setError(null);
		setProcessing({
			isProcessing: true,
			statusMessage: content.detectingLocation,
		});
		try {
			const position = await getCurrentPosition();
			const lat = position.coords.latitude;
			const lng = position.coords.longitude;
			const detectedLocation = await reverseGeocodeLocation(lat, lng, language);
			const geo: GeocodeResult = {
				lat,
				lng,
				displayName:
					detectedLocation?.displayName ??
					`${lat.toFixed(5)}, ${lng.toFixed(5)}`,
			};
			setSearchQuery(geo.displayName);
			await openImageryPicker(geo);
		} catch (err: unknown) {
			const geoErr = err as { message?: string; code?: number };
			if (geoErr?.message === "GEOLOCATION_UNSUPPORTED") {
				setError(content.locationUnavailable);
			} else if (geoErr?.code === 1) {
				setError(content.locationPermissionDenied);
			} else {
				setError(content.locationNotFound);
			}
		} finally {
			setProcessing({ isProcessing: false });
		}
	}, [
		language,
		openImageryPicker,
		content.detectingLocation,
		content.locationNotFound,
		content.locationPermissionDenied,
		content.locationUnavailable,
	]);

	const handleSearch = useCallback(
		async (query: string) => {
			if (!query.trim()) return;
			setSearchQuery(query);
			setProcessing({
				isProcessing: true,
				statusMessage:
					language === "en"
						? `Locating ${query}...`
						: `${query} wird gesucht...`,
			});
			setError(null);
			try {
				let geo = await geocodeBerlin(query, language);
				if (!geo && query.match(/\d+/)) {
					const streetOnly = query.replace(/\d+/, "").trim();
					setProcessing({
						isProcessing: true,
						statusMessage:
							language === "en"
								? `Address not found. Trying ${streetOnly}...`
								: `Adresse nicht gefunden. Versuche ${streetOnly}...`,
					});
					geo = await geocodeBerlin(streetOnly, language);
				}
				if (!geo) {
					throw new Error(
						language === "en"
							? `Could not locate "${query}" in Berlin. Try a major street or intersection.`
							: `"${query}" konnte in Berlin nicht gefunden werden. Versuchen Sie eine große Straße oder Kreuzung.`,
					);
				}
				await openImageryPicker(
					geo,
					isBerlinDistrict(query)
						? BERLIN_DISTRICT_SEARCH_RADIUS_M
						: DEFAULT_IMAGERY_SEARCH_RADIUS_M,
				);
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				const isQuotaError = isGeminiQuotaError(err);
				const isPermissionError =
					message.toLowerCase().includes("403") ||
					message.toLowerCase().includes("permission denied");

				if (isQuotaError) {
					setError(content.errorQuotaExceeded);
				} else if (isPermissionError) {
					setError(content.errorPermissionDenied);
					setHasApiKey(false);
				} else {
					setError(message || content.errorFailedStreetImage);
				}
			} finally {
				setProcessing({ isProcessing: false });
			}
		},
		[
			language,
			openImageryPicker,
			content.errorFailedStreetImage,
			content.errorPermissionDenied,
			content.errorQuotaExceeded,
		],
	);

	const isHeicLike = (file: File): boolean => {
		const name = file.name.toLowerCase();
		const type = (file.type || "").toLowerCase();
		return (
			name.endsWith(".heic") ||
			name.endsWith(".heif") ||
			type === "image/heic" ||
			type === "image/heif" ||
			type === "image/heic-sequence" ||
			type === "image/heif-sequence"
		);
	};

	const readFileAsDataUrl = (file: Blob): Promise<string> =>
		new Promise<string>((resolve, reject) => {
			const r = new FileReader();
			r.onload = () => resolve(r.result as string);
			r.onerror = () => reject(new Error("Failed to read file"));
			r.readAsDataURL(file);
		});

	const fileToDisplayBlob = async (file: File): Promise<Blob> => {
		if (!isHeicLike(file)) return file;
		const converted = await heic2any({
			blob: file,
			toType: "image/jpeg",
			quality: 0.92,
		});
		return Array.isArray(converted) ? converted[0] : converted;
	};

	const handleFileUpload = useCallback(
		async (e: React.ChangeEvent<HTMLInputElement>) => {
			const input = e.currentTarget;
			const files: File[] = input.files
				? Array.from(input.files).filter((f): f is File => f instanceof File)
				: [];
			input.value = "";
			if (!files.length) return;

			const imageFiles = files.filter(
				(f) => f.type.startsWith("image/") || isHeicLike(f),
			);
			if (!imageFiles.length) return;

			if (imageFiles.length === 1) {
				const file = imageFiles[0];
				setProcessing({
					isProcessing: true,
					statusMessage:
						language === "en"
							? "Processing your image..."
							: "Bild wird verarbeitet...",
				});
				try {
					const blob = await fileToDisplayBlob(file);
					const dataUrl = await readFileAsDataUrl(blob);
					editor.loadImageIntoEditor(dataUrl, "Original Upload");
				} catch (err: unknown) {
					const msg = err instanceof Error ? err.message : String(err);
					setError(msg || content.errorFailedUpload);
				} finally {
					setProcessing({ isProcessing: false });
				}
				return;
			}

			setProcessing({
				isProcessing: true,
				statusMessage:
					language === "en"
						? "Processing your images..."
						: "Bilder werden verarbeitet...",
			});
			setError(null);

			try {
				const entries: GeneratedImage[] = [];
				for (const file of imageFiles) {
					const blob = await fileToDisplayBlob(file);
					const dataUrl = await readFileAsDataUrl(blob);
					entries.push({
						id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
						dataUrl,
						prompt: file.name,
						timestamp: Date.now(),
					});
				}
				setUploadedGallery(entries);
				setSelectedGalleryId(entries[0]?.id ?? null);
				navigate("/image-gallery");
			} catch (err: unknown) {
				const msg = err instanceof Error ? err.message : String(err);
				setError(msg || content.errorFailedUpload);
				setProcessing({ isProcessing: false });
			} finally {
				setProcessing({ isProcessing: false });
			}
		},
		[editor, language, navigate, content.errorFailedUpload],
	);

	const handleOpenLibraryEntry = useCallback(
		async (item: LibraryEntry) => {
			setError(null);
			const full = await loadFullImageDataUrl(item, { prompt: true });
			if (!full) {
				setError(content.folderUnavailable);
				return;
			}
			library.setFolderStatus("connected");
			editor.loadFromLibraryEntry(full, item.prompt, item.timestamp);
		},
		[editor, library, content.folderUnavailable],
	);

	const handleDownloadLibraryEntry = useCallback(
		async (item: LibraryEntry) => {
			setError(null);
			const full = await loadFullImageDataUrl(item, { prompt: true });
			if (!full) {
				setError(content.folderUnavailable);
				return;
			}
			library.setFolderStatus("connected");
			const date = new Date(item.timestamp).toISOString().split("T")[0];
			const slug =
				(item.prompt || "KiezVision")
					.replace(/[^a-z0-9]/gi, "_")
					.slice(0, 60) || "KiezVision";
			const filename = `KiezVision_${date}_${slug}.png`;
			const a = document.createElement("a");
			a.href = full;
			a.download = filename;
			a.click();
		},
		[library, content.folderUnavailable],
	);

	const handleSaveToLibrary = useCallback(async () => {
		if (!editor.currentImage) return;
		const saved = await library.handleSaveToLibrary(
			editor.currentImage,
			editor.history[0]?.prompt || "Saved Image",
		);
		if (saved) editor.markImageExported(editor.currentImage);
	}, [editor, library]);

	const handleDownloadCurrentImage = useCallback(() => {
		if (!editor.currentImage) return;
		const date = new Date().toISOString().split("T")[0];
		const street =
			(editor.fetchedLocation || searchQuery)
				.trim()
				.replace(/[^a-z0-9]/gi, "_") || "Street";
		const filename = `Results_${date}_${street}.png`;
		const a = document.createElement("a");
		a.href = editor.currentImage;
		a.download = filename;
		a.click();
		editor.markImageExported(editor.currentImage);
	}, [editor, searchQuery]);

	const handleClearHistory = useCallback(() => {
		if (
			confirm(language === "en" ? "Discard project?" : "Projekt verwerfen?")
		) {
			window.location.reload();
		}
	}, [language]);

	const value = useMemo<AppContextValue>(
		() => ({
			language,
			setLanguage,
			content,
			processing,
			error,
			setError,
			searchQuery,
			setSearchQuery,
			library,
			editor,
			imageryPickerOpen,
			imageryPickerLocation,
			imageryPickerCandidates,
			imageryPickerRadiusM,
			imageryPickerStrings,
			setImageryPickerOpen,
			handleImageryConfirm,
			cameraOpen,
			cameraVideoRef,
			cameraModalRef,
			cameraFileFallbackRef,
			closeCamera,
			openDeviceCamera,
			capturePhotoFromVideo,
			uploadedGallery,
			selectedGalleryId,
			setSelectedGalleryId,
			handleSearch,
			handleAutoDetect,
			handleFileUpload,
			handleOpenLibraryEntry,
			handleDownloadLibraryEntry,
			handleSaveToLibrary,
			handleDownloadCurrentImage,
			handleClearHistory,
			reopenImageryPicker,
		}),
		[
			language,
			content,
			processing,
			error,
			searchQuery,
			library,
			editor,
			imageryPickerOpen,
			imageryPickerLocation,
			imageryPickerCandidates,
			imageryPickerRadiusM,
			imageryPickerStrings,
			handleImageryConfirm,
			cameraOpen,
			closeCamera,
			openDeviceCamera,
			capturePhotoFromVideo,
			uploadedGallery,
			selectedGalleryId,
			handleSearch,
			handleAutoDetect,
			handleFileUpload,
			handleOpenLibraryEntry,
			handleDownloadLibraryEntry,
			handleSaveToLibrary,
			handleDownloadCurrentImage,
			handleClearHistory,
			reopenImageryPicker,
		],
	);

	return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useIsAuthenticated(): [boolean, () => void] {
	const [isAuthenticated, setIsAuthenticated] = useState(() => {
		if (!isPasswordProtectionActive) return true;
		return sessionStorage.getItem("kv_auth") === "1";
	});
	const unlock = useCallback(() => setIsAuthenticated(true), []);
	return [isAuthenticated, unlock];
}
