import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ContentStrings } from "../content.ts";
import type { Language } from "../content.ts";
import type { LibraryEntry } from "../types.ts";
import {
	chooseRootDirectory,
	deleteEntryFiles,
	getLibraryFolderStatus,
	getRootHandleSilently,
	getRootHandleWithPrompt,
	isFileSystemAccessSupported,
	loadThumbnailObjectUrl,
	saveImageToLibrary,
	type LibraryFolderStatus,
} from "../services/libraryStorage.ts";

function parseInitialLibrary(): LibraryEntry[] {
	const saved = localStorage.getItem("kiezvision_library");
	if (!saved) return [];
	try {
		const parsed = JSON.parse(saved) as Array<
			Partial<LibraryEntry> & { id?: string; dataUrl?: string }
		>;
		return parsed
			.filter((item) => !item.id?.startsWith("ex"))
			.map((item): LibraryEntry => ({
				id:
					item.id ?? `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
				prompt: item.prompt ?? "Saved Image",
				timestamp: item.timestamp ?? Date.now(),
				folder: item.folder ?? "",
				filename: item.filename ?? "",
				thumbFilename: item.thumbFilename ?? "",
				dataUrl: item.dataUrl,
			}));
	} catch {
		return [];
	}
}

export interface UseLibraryOptions {
	language: Language;
	content: ContentStrings;
	setError: (error: string | null) => void;
}

export function useLibrary({ language, content, setError }: UseLibraryOptions) {
	const [library, setLibrary] = useState<LibraryEntry[]>(parseInitialLibrary);
	const [folderStatus, setFolderStatus] = useState<LibraryFolderStatus>("none");
	const [thumbCache, setThumbCache] = useState<Record<string, string>>({});
	const thumbLoadStatusRef = useRef<
		Record<string, "loading" | "done" | "failed">
	>({});

	const entryDateKey = useCallback((entry: LibraryEntry): string => {
		if (entry.folder) return entry.folder;
		const d = new Date(entry.timestamp);
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	}, []);

	const libraryByDate = useMemo<Array<[string, LibraryEntry[]]>>(() => {
		const groups = new Map<string, LibraryEntry[]>();
		for (const item of library) {
			if (item.id.startsWith("ex")) continue;
			const key = entryDateKey(item);
			const bucket = groups.get(key);
			if (bucket) bucket.push(item);
			else groups.set(key, [item]);
		}
		for (const arr of groups.values()) {
			arr.sort((a, b) => b.timestamp - a.timestamp);
		}
		return Array.from(groups.entries()).sort(([a], [b]) => {
			if (a < b) return 1;
			if (a > b) return -1;
			return 0;
		});
	}, [library, entryDateKey]);

	const formatDateHeader = useCallback(
		(dateKey: string): string => {
			const today = new Date();
			const todayKey = (() => {
				const yyyy = today.getFullYear();
				const mm = String(today.getMonth() + 1).padStart(2, "0");
				const dd = String(today.getDate()).padStart(2, "0");
				return `${yyyy}-${mm}-${dd}`;
			})();
			const yesterday = new Date(today);
			yesterday.setDate(today.getDate() - 1);
			const yesterdayKey = (() => {
				const yyyy = yesterday.getFullYear();
				const mm = String(yesterday.getMonth() + 1).padStart(2, "0");
				const dd = String(yesterday.getDate()).padStart(2, "0");
				return `${yyyy}-${mm}-${dd}`;
			})();
			if (dateKey === todayKey) return content.dateToday;
			if (dateKey === yesterdayKey) return content.dateYesterday;
			const [yyyy, mm, dd] = dateKey.split("-").map(Number);
			if (!yyyy || !mm || !dd) return dateKey;
			const date = new Date(yyyy, mm - 1, dd);
			return date.toLocaleDateString(language === "en" ? "en-US" : "de-DE", {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
		},
		[language, content.dateToday, content.dateYesterday],
	);

	useEffect(() => {
		try {
			localStorage.setItem("kiezvision_library", JSON.stringify(library));
		} catch (err) {
			console.warn("Failed to persist library to localStorage:", err);
		}
	}, [library]);

	useEffect(() => {
		let cancelled = false;
		(async () => {
			const status = await getLibraryFolderStatus();
			if (!cancelled) setFolderStatus(status);
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	useEffect(() => {
		if (folderStatus !== "connected") return;
		const statusMap = thumbLoadStatusRef.current;
		thumbLoadStatusRef.current = Object.fromEntries(
			Object.entries(statusMap).filter(([, status]) => status === "done"),
		);
	}, [folderStatus]);

	useEffect(() => {
		let cancelled = false;
		const statusMap = thumbLoadStatusRef.current;
		(async () => {
			for (const item of library) {
				if (item.id.startsWith("ex")) continue;
				if (cancelled) return;
				if (statusMap[item.id]) continue;
				statusMap[item.id] = "loading";
				const url = await loadThumbnailObjectUrl(item);
				if (cancelled) return;
				if (url) {
					statusMap[item.id] = "done";
					setThumbCache((prev) =>
						prev[item.id] ? prev : { ...prev, [item.id]: url },
					);
				} else {
					statusMap[item.id] = "failed";
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [library, folderStatus]);

	const ensureLibraryFolder = useCallback(async (): Promise<boolean> => {
		if (!isFileSystemAccessSupported()) {
			setError(
				language === "en"
					? "Saving to a library folder requires a Chromium-based browser (Chrome, Edge, Brave, Arc)."
					: "Das Speichern in einen Ordner erfordert einen Chromium-basierten Browser (Chrome, Edge, Brave, Arc).",
			);
			return false;
		}
		const silent = await getRootHandleSilently();
		if (silent) {
			setFolderStatus("connected");
			return true;
		}
		const reauth = await getRootHandleWithPrompt();
		if (reauth) {
			setFolderStatus("connected");
			return true;
		}
		const picked = await chooseRootDirectory();
		if (picked) {
			setFolderStatus("connected");
			return true;
		}
		return false;
	}, [language, setError]);

	const handleChooseLibraryFolder = useCallback(async () => {
		setError(null);
		try {
			const picked = await chooseRootDirectory();
			if (picked) setFolderStatus("connected");
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setError(msg || content.errorSelectFolder);
		}
	}, [setError, content.errorSelectFolder]);

	const handleReconnectLibraryFolder = useCallback(async () => {
		setError(null);
		try {
			const handle = await getRootHandleWithPrompt();
			if (handle) {
				setFolderStatus("connected");
			} else {
				setError(
					language === "en"
						? "Folder access was not granted. Try again or pick a different folder."
						: "Zugriff auf den Ordner wurde nicht erteilt. Versuche es erneut oder wähle einen anderen Ordner.",
				);
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			setError(msg || content.errorReconnectFolder);
		}
	}, [language, setError, content.errorReconnectFolder]);

	const handleSaveToLibrary = useCallback(
		async (dataUrl: string, prompt: string) => {
			setError(null);
			try {
				const ready = await ensureLibraryFolder();
				if (!ready) return false;
				const ts = Date.now();
				const { entry } = await saveImageToLibrary({
					dataUrl,
					prompt,
					timestamp: ts,
				});
				setLibrary((prev) => [entry, ...prev]);
				alert(
					language === "en"
						? "Saved to your library!"
						: "In Ihrer Galerie gespeichert!",
				);
				return true;
			} catch (err: unknown) {
				const message = err instanceof Error ? err.message : String(err);
				if (message === "NO_LIBRARY_FOLDER") {
					setError(
						language === "en"
							? "Pick a library folder first to save your visions on disk."
							: "Bitte zuerst einen Galerie-Ordner auswählen, um Visionen auf der Festplatte zu speichern.",
					);
					return false;
				}
				console.error("Save to library failed:", err);
				setError(
					language === "en"
						? "Could not save to library. Please try again."
						: "Speichern in der Galerie fehlgeschlagen. Bitte erneut versuchen.",
				);
				return false;
			}
		},
		[ensureLibraryFolder, language, setError],
	);

	const removeFromLibrary = useCallback(
		async (id: string) => {
			const target = library.find((item) => item.id === id);
			setLibrary((prev) => prev.filter((item) => item.id !== id));
			setThumbCache((prev) => {
				const url = prev[id];
				if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
				const { [id]: _removed, ...next } = prev;
				return next;
			});
			if (target) {
				try {
					await deleteEntryFiles(target);
				} catch (err) {
					console.warn("Failed to delete files on disk:", err);
				}
			}
		},
		[library],
	);

	const userSavedCount = library.filter(
		(item) => !item.id.startsWith("ex"),
	).length;

	return {
		library,
		setLibrary,
		folderStatus,
		setFolderStatus,
		thumbCache,
		libraryByDate,
		formatDateHeader,
		userSavedCount,
		ensureLibraryFolder,
		handleChooseLibraryFolder,
		handleReconnectLibraryFolder,
		handleSaveToLibrary,
		removeFromLibrary,
	};
}
