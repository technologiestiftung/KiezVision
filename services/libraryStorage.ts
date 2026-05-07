import { LibraryEntry } from '../types';

// ---------------------------------------------------------------------------
// Tiny IndexedDB key/value store, used only to persist ONE FileSystemDirectoryHandle.
// We store the directory handle (a non-serializable object) here because it
// can't be put into localStorage. This is not a "database" in any real sense
// of the word — it's a single key holding a single opaque object.
// ---------------------------------------------------------------------------

const IDB_NAME = 'kiezvision-fs';
const IDB_STORE = 'handles';
const HANDLE_KEY = 'libraryRoot';

const openIdb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const idbGet = async <T>(key: string): Promise<T | undefined> => {
  const db = await openIdb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
  });
};

const idbSet = async (key: string, value: unknown): Promise<void> => {
  const db = await openIdb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

const idbDelete = async (key: string): Promise<void> => {
  const db = await openIdb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

// ---------------------------------------------------------------------------
// File System Access feature detection
// ---------------------------------------------------------------------------

export const isFileSystemAccessSupported = (): boolean =>
  typeof window !== 'undefined' && 'showDirectoryPicker' in window;

// ---------------------------------------------------------------------------
// Directory handle: pick / restore / verify permission
// ---------------------------------------------------------------------------

type FSDirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (desc: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

let cachedRoot: FSDirHandle | null = null;

const verifyPermission = async (
  handle: FSDirHandle,
  prompt: boolean
): Promise<boolean> => {
  const opts: { mode: 'readwrite' } = { mode: 'readwrite' };
  if (handle.queryPermission) {
    const status = await handle.queryPermission(opts);
    if (status === 'granted') return true;
    // Without a user gesture we cannot upgrade 'prompt' or 'denied' to
    // 'granted', so silent verification must reject anything that isn't
    // already granted — otherwise callers will receive a handle whose
    // file reads will throw NotAllowedError on first use.
    if (!prompt) return false;
  }
  if (prompt && handle.requestPermission) {
    const status = await handle.requestPermission(opts);
    return status === 'granted';
  }
  return false;
};

/** Returns the persisted root handle if the browser still grants permission silently. */
export const getRootHandleSilently = async (): Promise<FSDirHandle | null> => {
  if (!isFileSystemAccessSupported()) return null;
  if (cachedRoot) {
    const ok = await verifyPermission(cachedRoot, false);
    if (ok) return cachedRoot;
  }
  try {
    const stored = await idbGet<FSDirHandle>(HANDLE_KEY);
    if (!stored) return null;
    const ok = await verifyPermission(stored, false);
    if (!ok) return null;
    cachedRoot = stored;
    return stored;
  } catch {
    return null;
  }
};

/**
 * Status of the persisted library folder handle without prompting the user.
 * - `connected`: handle exists and the browser grants access silently.
 * - `needs-permission`: handle exists in IndexedDB but the browser requires a
 *   user gesture to re-grant access (typical right after a page reload).
 * - `none`: no folder has ever been picked.
 * - `unsupported`: this browser does not support the File System Access API.
 */
export type LibraryFolderStatus =
  | 'connected'
  | 'needs-permission'
  | 'none'
  | 'unsupported';

export const getLibraryFolderStatus = async (): Promise<LibraryFolderStatus> => {
  if (!isFileSystemAccessSupported()) return 'unsupported';
  let stored: FSDirHandle | undefined;
  try {
    stored = cachedRoot ?? (await idbGet<FSDirHandle>(HANDLE_KEY));
  } catch {
    return 'none';
  }
  if (!stored) return 'none';
  cachedRoot = stored;
  if (!stored.queryPermission) return 'needs-permission';
  try {
    const perm = await stored.queryPermission({ mode: 'readwrite' });
    if (perm === 'granted') return 'connected';
    return 'needs-permission';
  } catch {
    return 'needs-permission';
  }
};

/**
 * Returns the root handle, prompting the user to re-grant permission if needed.
 * Returns null if the user has never picked a folder.
 */
export const getRootHandleWithPrompt = async (): Promise<FSDirHandle | null> => {
  if (!isFileSystemAccessSupported()) return null;
  const stored = cachedRoot ?? (await idbGet<FSDirHandle>(HANDLE_KEY));
  if (!stored) return null;
  const ok = await verifyPermission(stored, true);
  if (!ok) return null;
  cachedRoot = stored;
  return stored;
};

/** Prompts the user to pick a folder and persists the handle for future sessions. */
export const chooseRootDirectory = async (): Promise<FSDirHandle | null> => {
  if (!isFileSystemAccessSupported()) {
    throw new Error('File System Access API is not supported in this browser.');
  }
  const w = window as unknown as {
    showDirectoryPicker: (opts?: {
      mode?: 'read' | 'readwrite';
      startIn?: 'pictures' | 'documents' | 'desktop' | 'downloads' | 'music' | 'videos';
      id?: string;
    }) => Promise<FSDirHandle>;
  };
  try {
    const handle = await w.showDirectoryPicker({
      mode: 'readwrite',
      startIn: 'pictures',
      id: 'kiezvision-library',
    });
    const ok = await verifyPermission(handle, true);
    if (!ok) return null;
    await idbSet(HANDLE_KEY, handle);
    cachedRoot = handle;
    return handle;
  } catch (err) {
    // User cancelled the picker — surface as null, not as an error.
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
};

export const forgetRootDirectory = async (): Promise<void> => {
  cachedRoot = null;
  try {
    await idbDelete(HANDLE_KEY);
  } catch {
    // ignore
  }
};

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

const folderForDate = (timestamp: number): string => {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const ensureSubfolder = async (
  root: FSDirHandle,
  name: string
): Promise<FSDirHandle> =>
  (await root.getDirectoryHandle(name, { create: true })) as FSDirHandle;

// ---------------------------------------------------------------------------
// Image helpers (data URL <-> Blob, thumbnail generation)
// ---------------------------------------------------------------------------

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return await res.blob();
};

const blobToObjectUrl = (blob: Blob): string => URL.createObjectURL(blob);

const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });

const generateThumbnailBlob = async (
  fullDataUrl: string,
  maxEdge = 400,
  quality = 0.85
): Promise<Blob> => {
  const img = await loadImageElement(fullDataUrl);
  const ratio = img.width > img.height ? maxEdge / img.width : maxEdge / img.height;
  const scale = Math.min(1, ratio);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create canvas context for thumbnail.');
  ctx.drawImage(img, 0, 0, w, h);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Thumbnail encoding failed'))),
      'image/jpeg',
      quality
    );
  });
};

// ---------------------------------------------------------------------------
// Public save / load / delete
// ---------------------------------------------------------------------------

export interface SaveResult {
  entry: LibraryEntry;
}

/**
 * Writes the full image (PNG) and a small JPEG thumbnail to the user's library
 * folder, organized by date. Returns the metadata to be persisted in localStorage.
 */
export const saveImageToLibrary = async (params: {
  dataUrl: string;
  prompt: string;
  timestamp?: number;
}): Promise<SaveResult> => {
  const root = await getRootHandleSilently();
  if (!root) {
    throw new Error('NO_LIBRARY_FOLDER');
  }

  const ts = params.timestamp ?? Date.now();
  const folder = folderForDate(ts);
  const id = `${ts}_${Math.random().toString(16).slice(2, 8)}`;
  const baseName = `vision-${id}`;
  const filename = `${baseName}.png`;
  const thumbFilename = `${baseName}.thumb.jpg`;

  const dayHandle = await ensureSubfolder(root, folder);

  const fullBlob = await dataUrlToBlob(params.dataUrl);
  const thumbBlob = await generateThumbnailBlob(params.dataUrl);

  const writeFile = async (name: string, blob: Blob) => {
    const fileHandle = await dayHandle.getFileHandle(name, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(blob);
    await writable.close();
  };

  await writeFile(filename, fullBlob);
  await writeFile(thumbFilename, thumbBlob);

  return {
    entry: {
      id,
      prompt: params.prompt,
      timestamp: ts,
      folder,
      filename,
      thumbFilename,
    },
  };
};

const readFileAsObjectUrl = async (
  root: FSDirHandle,
  folder: string,
  filename: string
): Promise<string> => {
  const dayHandle = (await root.getDirectoryHandle(folder, {
    create: false,
  })) as FSDirHandle;
  const fileHandle = await dayHandle.getFileHandle(filename, { create: false });
  const file = await fileHandle.getFile();
  return blobToObjectUrl(file);
};

const readFileAsDataUrl = async (
  root: FSDirHandle,
  folder: string,
  filename: string
): Promise<string> => {
  const dayHandle = (await root.getDirectoryHandle(folder, {
    create: false,
  })) as FSDirHandle;
  const fileHandle = await dayHandle.getFileHandle(filename, { create: false });
  const file = await fileHandle.getFile();
  return await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error('Failed to read image'));
    r.readAsDataURL(file);
  });
};

interface LoadOptions {
  /**
   * If true, falls back to prompting the user to re-grant permission when the
   * silent permission check fails. Only call this from inside a user-gesture
   * handler (click, keypress) — browsers reject permission prompts otherwise.
   */
  prompt?: boolean;
}

const resolveRoot = async (opts?: LoadOptions): Promise<FSDirHandle | null> => {
  const silent = await getRootHandleSilently();
  if (silent) return silent;
  if (!opts?.prompt) return null;
  return await getRootHandleWithPrompt();
};

export const loadThumbnailObjectUrl = async (
  entry: LibraryEntry,
  opts?: LoadOptions
): Promise<string | null> => {
  if (entry.dataUrl) return entry.dataUrl; // legacy fallback
  const root = await resolveRoot(opts);
  if (!root) return null;
  try {
    return await readFileAsObjectUrl(root, entry.folder, entry.thumbFilename);
  } catch (thumbErr) {
    // Thumbnail file may be missing (e.g. older save where thumb generation
    // hadn't run yet). Fall back to the full PNG so the card still shows
    // something instead of staying blank.
    try {
      return await readFileAsObjectUrl(root, entry.folder, entry.filename);
    } catch (fullErr) {
      console.warn('Could not load thumbnail or full image for entry', entry.id, {
        thumbErr,
        fullErr,
      });
      return null;
    }
  }
};

export const loadFullImageDataUrl = async (
  entry: LibraryEntry,
  opts?: LoadOptions
): Promise<string | null> => {
  if (entry.dataUrl) return entry.dataUrl; // legacy fallback
  const root = await resolveRoot(opts);
  if (!root) return null;
  try {
    return await readFileAsDataUrl(root, entry.folder, entry.filename);
  } catch {
    return null;
  }
};

export const deleteEntryFiles = async (entry: LibraryEntry): Promise<void> => {
  if (entry.dataUrl && !entry.filename) return; // pure-legacy entry, nothing on disk
  const root = await getRootHandleSilently();
  if (!root) return;
  try {
    const dayHandle = (await root.getDirectoryHandle(entry.folder, {
      create: false,
    })) as FSDirHandle;
    await dayHandle.removeEntry(entry.filename).catch(() => undefined);
    await dayHandle.removeEntry(entry.thumbFilename).catch(() => undefined);
  } catch {
    // best-effort
  }
};
