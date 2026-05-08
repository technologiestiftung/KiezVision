import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLocation, useNavigate, type NavigateFunction } from 'react-router-dom';
import heic2any from 'heic2any';
import { PixelLeafLoader } from './components/PixelLeafLoader';
import { 
  Upload, AlertCircle, Sparkles, Download, Building2, 
  History, RotateCcw, Search, MousePointer2, Paintbrush2, 
  Sliders, Wand2, Camera, Library, Save, ArrowLeft, Trash2, FolderOpen, Eraser
} from 'lucide-react';
import { BeforeAfterSlider } from './components/BeforeAfterSlider';
import { InpaintCanvas } from './components/InpaintCanvas';
import { QuickActions } from './components/QuickActions';
import { TransformationPanel } from './components/TransformationPanel';
import { transformImage } from './services/geminiService';
import { geocodeBerlin, fetchMapillaryImage, reverseGeocodeLocation } from './services/mapillaryService';
import { buildTransformPrompt } from './services/presetRules';
import {
  isFileSystemAccessSupported,
  getRootHandleSilently,
  getRootHandleWithPrompt,
  chooseRootDirectory,
  saveImageToLibrary,
  loadThumbnailObjectUrl,
  loadFullImageDataUrl,
  deleteEntryFiles,
  getLibraryFolderStatus,
  type LibraryFolderStatus,
} from './services/libraryStorage';
import { GeneratedImage, LibraryEntry, ProcessingState } from './types';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

const BERLIN_DISTRICTS = [
  "Mitte", "Friedrichshain", "Kreuzberg", "Prenzlauer Berg", 
  "Neukölln", "Charlottenburg", "Schöneberg", "Wedding", "Moabit", "Tempelhof"
];

const kiezvisionLogoUrl = '/kiezvision_logo.png';

function BackToHomeNavButton({
  navigate,
  label,
  className = '',
}: {
  navigate: NavigateFunction;
  label: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => navigate('/')}
      className={`flex items-center gap-2 text-eb-900 font-black border-2 border-eb-900 px-4 h-10 bg-coral-100 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none transition-all${className ? ` ${className}` : ''}`}
    >
      <ArrowLeft className="w-4 h-4" /> {label}
    </button>
  );
}

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const normalizePath = (pathname: string) => {
    // Backwards-compat with the requested (typo) route.
    if (pathname === '/libray') return '/library';
    return pathname;
  };

  const normalizedPath = normalizePath(location.pathname);
  const view: 'home' | 'editor' | 'library' | 'image-gallery' =
    normalizedPath === '/edit' ? 'editor' :
    normalizedPath === '/library' ? 'library' :
    normalizedPath === '/image-gallery' ? 'image-gallery' :
    'home';

  const [language, setLanguage] = useState<'en' | 'de'>('en');

  const t = {
    en: {
      tagline: "Street vision toolkit",
      subtitle: "Envision a greener, car-free future using real Mapillary imagery or AI visions.",
      reimagine: "Reimagine",
      yourStreet: "Your Street",
      searchPlaceholder: "Search for a street (e.g. Kurfürstendamm)...",
      autoDetect: "Auto Detect",
      go: "GO",
      exploreDistricts: "Explore Districts",
      uploadPhoto: "Upload Photo",
      openFolder: "Open Folder",
      capture: "Capture",
      library: "Library",
      backToHome: "Back to Home",
      imageLibrary: "Image Library",
      startTransformation: "Start Transformation",
      imageGallery: "Image Gallery",
      editThisImage: "Edit this image",
      yourSavedVisions: "Your Saved Visions",
      libraryEmptyTitle: "No saved visions yet",
      libraryEmptySubtitle: "Transform a Berlin street in the editor and hit Save to add your first vision here.",
      libraryEmptyCta: "Start a new vision",
      dateToday: "Today",
      dateYesterday: "Yesterday",
      visionsCount: "visions",
      visionCountSingular: "vision",
      libraryFolderConnected: "Library folder connected",
      libraryFolderDisconnected: "No library folder yet",
      libraryFolderNeedsPermission: "Library folder needs to be reconnected",
      reconnectLibraryFolder: "Reconnect Folder",
      reconnectBannerTitle: "Reconnect your library folder",
      reconnectBannerSubtitle: "Browsers ask for permission again after a refresh. One click brings your saved visions back.",
      chooseLibraryFolder: "Choose Library Folder",
      changeLibraryFolder: "Change Folder",
      folderUnavailable: "Saved file not found on disk. The folder may have moved or the file was deleted.",
      browserUnsupportedFolder: "Saving to a folder requires a Chromium browser (Chrome, Edge, Brave, Arc).",
      openInEditor: "Open in Editor",
      compare: "Compare",
      areaEdit: "Area Edit",
      save: "Save",
      clearHistory: "Clear History",
      toolkit: "Transformation Toolkit",
      size: "Size",
      presets: "Presets",
      customCommand: "Custom Command",
      placeholderEditor: "Describe the transformation (e.g. 'add solar panels', 'planting day')...",
      placeholderMask: "Describe what to put in the selected area (e.g. 'add a tree', 'park bench')...",
      loading: "Loading from library...",
      fetchingStreet: "Fetching your street...",
      detectingLocation: "Detecting your location...",
      locationUnavailable: "Current location is not available in this browser.",
      locationPermissionDenied: "Location permission was denied. Allow location access and try again.",
      locationNotFound: "Could not identify a nearby street for your current location.",
      synthesizing: "Synthesizing...",
      iterations: "Model Iterations",
      maskSettings: "Mask settings",
      brush: "Brush",
      eraser: "Eraser",
      clearMask: "Clear mask",
      areaEditTipTitle: "Placement tip",
      areaEditTipBody: "Brush roughly where you want the change — it is only a hint. The model fits the scene as a whole photo.",
      sourceMapillary: "Mapillary Real Image",
      sourceAI: "AI Generated",
      realPhoto: "real photo",
      aiVision: "AI vision",
      takePhoto: "Take photo",
      cancelCamera: "Cancel",
    },
    de: {
      tagline: "Straßen-Vision-Toolkit",
      subtitle: "Stellen Sie sich eine grünere, autofreie Zukunft vor, basierend auf echten Mapillary-Bildern oder KI-Visionen.",
      reimagine: "Ihre Straße",
      yourStreet: "neu denken",
      searchPlaceholder: "Nach einer Straße suchen (z.B. Kurfürstendamm)...",
      autoDetect: "Auto-Erkennung",
      go: "LOS",
      exploreDistricts: "Bezirke erkunden",
      uploadPhoto: "Foto hochladen",
      openFolder: "Ordner öffnen",
      capture: "Aufnehmen",
      library: "Galerie",
      backToHome: "Zurück zum Start",
      imageLibrary: "Bildgalerie",
      startTransformation: "Transformation starten",
      imageGallery: "Bildergalerie",
      editThisImage: "Dieses Bild bearbeiten",
      yourSavedVisions: "Ihre gespeicherten Visionen",
      libraryEmptyTitle: "Noch keine gespeicherten Visionen",
      libraryEmptySubtitle: "Transformiere eine Berliner Straße im Editor und klicke auf Speichern, um deine erste Vision hier abzulegen.",
      libraryEmptyCta: "Neue Vision starten",
      dateToday: "Heute",
      dateYesterday: "Gestern",
      visionsCount: "Visionen",
      visionCountSingular: "Vision",
      libraryFolderConnected: "Galerie-Ordner verbunden",
      libraryFolderDisconnected: "Noch kein Galerie-Ordner",
      libraryFolderNeedsPermission: "Galerie-Ordner muss erneut verbunden werden",
      reconnectLibraryFolder: "Ordner erneut verbinden",
      reconnectBannerTitle: "Galerie-Ordner erneut verbinden",
      reconnectBannerSubtitle: "Browser fragen nach einem Reload erneut nach der Berechtigung. Ein Klick stellt deine gespeicherten Visionen wieder her.",
      chooseLibraryFolder: "Galerie-Ordner wählen",
      changeLibraryFolder: "Ordner ändern",
      folderUnavailable: "Datei auf der Festplatte nicht gefunden. Der Ordner wurde verschoben oder die Datei gelöscht.",
      browserUnsupportedFolder: "Speichern in einem Ordner erfordert einen Chromium-Browser (Chrome, Edge, Brave, Arc).",
      openInEditor: "Im Editor öffnen",
      compare: "Vergleichen",
      areaEdit: "Bereich bearbeiten",
      save: "Speichern",
      fetchingStreet: "Suche deine Straße...",
      detectingLocation: "Standort wird ermittelt...",
      locationUnavailable: "Der aktuelle Standort ist in diesem Browser nicht verfügbar.",
      locationPermissionDenied: "Standortberechtigung wurde abgelehnt. Erlaube den Standortzugriff und versuche es erneut.",
      locationNotFound: "Es konnte keine nahegelegene Straße für deinen aktuellen Standort gefunden werden.",
      clearHistory: "Verlauf leeren",
      toolkit: "Transformations-Toolkit",
      size: "Größe",
      presets: "Vorlagen",
      customCommand: "Eigener Befehl",
      placeholderEditor: "Beschreiben Sie die Änderung (z.B. 'Solarzellen hinzufügen', 'Pflanztag')...",
      placeholderMask: "Beschreiben Sie, was in den Bereich soll (z.B. 'ein Baum', 'Parkbank')...",
      loading: "Lade aus Galerie...",
      synthesizing: "Synthese läuft...",
      iterations: "Modell-Iterationen",
      maskSettings: "Masken-Einstellungen",
      brush: "Pinsel",
      eraser: "Radierer",
      clearMask: "Maske leeren",
      areaEditTipTitle: "Platzierung",
      areaEditTipBody: "Malen Sie ungefähr dort, wo Sie die Änderung wollen — nur ein Hinweis. Das Modell fügt sie ins Gesamtbild ein.",
      sourceMapillary: "Echtes Bild",
      sourceAI: "KI-Generiert",
      realPhoto: "Echtes Foto",
      aiVision: "KI-Vision",
      takePhoto: "Foto aufnehmen",
      cancelCamera: "Abbrechen",
    }
  }[language];
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [library, setLibrary] = useState<LibraryEntry[]>(() => {
    const saved = localStorage.getItem('kiezvision_library');
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as Array<Partial<LibraryEntry> & { id?: string; dataUrl?: string }>;
      return parsed
        .filter((item) => !item.id?.startsWith('ex'))
        .map((item): LibraryEntry => ({
          id: item.id ?? `${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
          prompt: item.prompt ?? 'Saved Image',
          timestamp: item.timestamp ?? Date.now(),
          folder: item.folder ?? '',
          filename: item.filename ?? '',
          thumbFilename: item.thumbFilename ?? '',
          dataUrl: item.dataUrl,
        }));
    } catch {
      return [];
    }
  });
  const [folderStatus, setFolderStatus] = useState<LibraryFolderStatus>('none');
  const [thumbCache, setThumbCache] = useState<Record<string, string>>({});
  const thumbLoadStatusRef = useRef<Record<string, 'loading' | 'done' | 'failed'>>({});

  // Returns the YYYY-MM-DD bucket an entry belongs to. New entries already
  // have a `folder` field that matches; legacy entries (saved before the
  // on-disk library existed) get derived from their timestamp.
  const entryDateKey = useCallback((entry: LibraryEntry): string => {
    if (entry.folder) return entry.folder;
    const d = new Date(entry.timestamp);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  // Saved visions grouped by date, most recent first; entries within a group
  // are also sorted newest-first.
  const libraryByDate = useMemo<Array<[string, LibraryEntry[]]>>(() => {
    const groups = new Map<string, LibraryEntry[]>();
    for (const item of library) {
      if (item.id.startsWith('ex')) continue;
      const key = entryDateKey(item);
      const bucket = groups.get(key);
      if (bucket) bucket.push(item);
      else groups.set(key, [item]);
    }
    for (const arr of groups.values()) {
      arr.sort((a, b) => b.timestamp - a.timestamp);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0));
  }, [library, entryDateKey]);

  const formatDateHeader = useCallback(
    (dateKey: string): string => {
      const today = new Date();
      const todayKey = (() => {
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      })();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      const yesterdayKey = (() => {
        const yyyy = yesterday.getFullYear();
        const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
        const dd = String(yesterday.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
      })();
      if (dateKey === todayKey) return t.dateToday;
      if (dateKey === yesterdayKey) return t.dateYesterday;
      const [yyyy, mm, dd] = dateKey.split('-').map(Number);
      if (!yyyy || !mm || !dd) return dateKey;
      const date = new Date(yyyy, mm - 1, dd);
      return date.toLocaleDateString(language === 'en' ? 'en-US' : 'de-DE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    },
    [language, t.dateToday, t.dateYesterday]
  );
  const [uploadedGallery, setUploadedGallery] = useState<GeneratedImage[]>([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [fetchedLocation, setFetchedLocation] = useState<string | null>(null);
  const [mapillaryMetadata, setMapillaryMetadata] = useState<{ link: string; capturedAt?: string } | null>(null);
  
  // Editor States
  const [editMode, setEditMode] = useState<'comparison' | 'mask'>('comparison');
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  /** Bumps on each "Area Edit" entry so InpaintCanvas always mounts fresh (avoids one-shot brush bugs from reused state). */
  const [inpaintMountKey, setInpaintMountKey] = useState(0);
  const [isAreaEditEraser, setIsAreaEditEraser] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [highQuality, setHighQuality] = useState(false);
  // Tracks whether the *current* editor image has been exported (saved/downloaded).
  // Leaving the editor without exporting warns the user that changes will be lost.
  const [lastExportedImage, setLastExportedImage] = useState<string | null>(null);
  const [showLeaveEditorConfirm, setShowLeaveEditorConfirm] = useState(false);
  const [pendingPathAfterLeaveConfirm, setPendingPathAfterLeaveConfirm] = useState<string | null>(null);
  const lastNormalizedPathRef = useRef<string | null>(null);
  const canvasRef = useRef<{
    clear: () => void;
    getMaskDataUrl: () => string | null;
  } | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraFileFallbackRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const stopCameraStream = useCallback(() => {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, []);

  const loadImageIntoEditor = useCallback(
    (dataUrl: string, prompt: string) => {
      setOriginalImage(dataUrl);
      setCurrentImage(dataUrl);
      setError(null);
      setHistory([{ id: 'original', dataUrl, prompt, timestamp: Date.now() }]);
      setEditMode('comparison');
      setLastExportedImage(null);
      navigate('/edit');
    },
    [navigate]
  );

  const hasUnexportedChanges = useMemo(() => {
    if (view !== 'editor') return false;
    if (!currentImage) return false;
    return currentImage !== lastExportedImage;
  }, [currentImage, lastExportedImage, view]);

  const requestLeaveEditor = useCallback(
    (path: string) => {
      if (view === 'editor' && hasUnexportedChanges) {
        setPendingPathAfterLeaveConfirm(path);
        setShowLeaveEditorConfirm(true);
        return;
      }
      navigate(path);
    },
    [hasUnexportedChanges, navigate, view]
  );

  useEffect(() => {
    if (!cameraOpen) return;
    const video = cameraVideoRef.current;
    const stream = cameraStreamRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.setAttribute('playsinline', 'true');
    video.play().catch(() => {});
  }, [cameraOpen]);

  useEffect(() => {
    return () => stopCameraStream();
  }, [stopCameraStream]);

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
      await tryStream({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch {
      try {
        await tryStream({ video: { facingMode: 'user' }, audio: false });
      } catch {
        try {
          await tryStream({ video: true, audio: false });
        } catch {
          cameraFileFallbackRef.current?.click();
        }
      }
    }
  }, []);

  const closeCamera = useCallback(() => {
    stopCameraStream();
    setCameraOpen(false);
  }, [stopCameraStream]);

  const capturePhotoFromVideo = useCallback(() => {
    const video = cameraVideoRef.current;
    if (!video || video.readyState < 2) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    closeCamera();
    loadImageIntoEditor(dataUrl, language === 'en' ? 'Camera capture' : 'Kameraaufnahme');
  }, [closeCamera, loadImageIntoEditor, language]);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        // Fallback for local dev if window.aistudio is missing
        setHasApiKey(true);
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (location.pathname !== normalizedPath) {
      navigate(normalizedPath, { replace: true });
      return;
    }
    if (!['/', '/library', '/edit', '/image-gallery'].includes(normalizedPath)) {
      navigate('/', { replace: true });
    }
  }, [location.pathname, navigate, normalizedPath]);

  // Catch browser back/forward (or any route change) away from the editor when
  // there are unexported changes, and present a confirmation modal.
  useEffect(() => {
    const prev = lastNormalizedPathRef.current;
    lastNormalizedPathRef.current = normalizedPath;
    if (!prev) return;
    if (prev === '/edit' && normalizedPath !== '/edit' && hasUnexportedChanges) {
      setPendingPathAfterLeaveConfirm(normalizedPath);
      setShowLeaveEditorConfirm(true);
      navigate('/edit', { replace: true });
    }
  }, [hasUnexportedChanges, navigate, normalizedPath]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  useEffect(() => {
    try {
      localStorage.setItem('kiezvision_library', JSON.stringify(library));
    } catch (err) {
      // Swallow errors here so an exception inside this effect can't tear down
      // the React tree. With on-disk storage the metadata is tiny, so this
      // path is effectively unreachable; kept as a defensive net.
      console.warn('Failed to persist library to localStorage:', err);
    }
  }, [library]);

  useEffect(() => {
    setIsAreaEditEraser(false);
  }, [inpaintMountKey]);

  // On mount, detect the persisted library folder status without prompting.
  // We don't auto-prompt; the user re-grants permission via the "Reconnect"
  // banner / button (browsers require a user gesture for that).
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

  // When a folder becomes connected again, retry any thumbnails that failed
  // earlier (e.g. before reconnect, or while permission was off). We also
  // clear entries stuck in 'loading' from a previously-cancelled run; only
  // 'done' entries are preserved so successful thumbnails aren't re-fetched.
  useEffect(() => {
    if (folderStatus !== 'connected') return;
    const statusMap = thumbLoadStatusRef.current;
    for (const id of Object.keys(statusMap)) {
      if (statusMap[id] !== 'done') delete statusMap[id];
    }
  }, [folderStatus]);

  // Lazily resolve thumbnails for visible saved-vision cards. Each entry is
  // attempted at most once per attempt-window (tracked in a ref) so failed
  // loads don't retry forever and successful loads aren't re-fetched.
  useEffect(() => {
    let cancelled = false;
    const statusMap = thumbLoadStatusRef.current;
    (async () => {
      for (const item of library) {
        if (item.id.startsWith('ex')) continue;
        if (cancelled) return;
        if (statusMap[item.id]) continue;
        statusMap[item.id] = 'loading';
        const url = await loadThumbnailObjectUrl(item);
        if (cancelled) return;
        if (url) {
          statusMap[item.id] = 'done';
          setThumbCache((prev) => (prev[item.id] ? prev : { ...prev, [item.id]: url }));
        } else {
          statusMap[item.id] = 'failed';
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [library, folderStatus]);

  const isHeicLike = (file: File): boolean => {
    const name = file.name.toLowerCase();
    const type = (file.type || '').toLowerCase();
    return (
      name.endsWith('.heic') ||
      name.endsWith('.heif') ||
      type === 'image/heic' ||
      type === 'image/heif' ||
      type === 'image/heic-sequence' ||
      type === 'image/heif-sequence'
    );
  };

  const readFileAsDataUrl = (file: Blob): Promise<string> =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error('Failed to read file'));
      r.readAsDataURL(file);
    });

  const fileToDisplayBlob = async (file: File): Promise<Blob> => {
    if (!isHeicLike(file)) return file;
    const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
    // heic2any can return a single Blob or an array of Blobs; we only take the first.
    return Array.isArray(converted) ? converted[0] : converted;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const files: File[] = input.files
      ? Array.from(input.files).filter((f): f is File => f instanceof File)
      : [];
    input.value = '';
    if (!files.length) return;

    const imageFiles = files.filter((f) => f.type.startsWith('image/') || isHeicLike(f));
    if (!imageFiles.length) return;

    if (imageFiles.length === 1) {
      const file = imageFiles[0];
      setProcessing({
        isProcessing: true,
        statusMessage: language === 'en' ? 'Processing your image...' : 'Bild wird verarbeitet...',
      });
      try {
        const blob = await fileToDisplayBlob(file);
        const dataUrl = await readFileAsDataUrl(blob);
        loadImageIntoEditor(dataUrl, 'Original Upload');
      } catch (err: any) {
        setError(err?.message || 'Failed to process upload.');
      } finally {
        setProcessing({ isProcessing: false });
      }
      return;
    }

    setProcessing({
      isProcessing: true,
      statusMessage: language === 'en' ? 'Processing your images...' : 'Bilder werden verarbeitet...',
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
      navigate('/image-gallery');
    } catch (err: any) {
      setError(err?.message || 'Failed to process upload.');
      setProcessing({ isProcessing: false });
    } finally {
      setProcessing({ isProcessing: false });
    }
  };

  const ensureLibraryFolder = useCallback(async (): Promise<boolean> => {
    if (!isFileSystemAccessSupported()) {
      setError(
        language === 'en'
          ? 'Saving to a library folder requires a Chromium-based browser (Chrome, Edge, Brave, Arc).'
          : 'Das Speichern in einen Ordner erfordert einen Chromium-basierten Browser (Chrome, Edge, Brave, Arc).'
      );
      return false;
    }
    const silent = await getRootHandleSilently();
    if (silent) {
      setFolderStatus('connected');
      return true;
    }
    const reauth = await getRootHandleWithPrompt();
    if (reauth) {
      setFolderStatus('connected');
      return true;
    }
    const picked = await chooseRootDirectory();
    if (picked) {
      setFolderStatus('connected');
      return true;
    }
    return false;
  }, [language]);

  const handleChooseLibraryFolder = useCallback(async () => {
    setError(null);
    try {
      const picked = await chooseRootDirectory();
      if (picked) {
        setFolderStatus('connected');
      }
    } catch (err: any) {
      setError(err?.message || 'Could not select folder.');
    }
  }, []);

  const handleReconnectLibraryFolder = useCallback(async () => {
    setError(null);
    try {
      const handle = await getRootHandleWithPrompt();
      if (handle) {
        setFolderStatus('connected');
      } else {
        setError(
          language === 'en'
            ? 'Folder access was not granted. Try again or pick a different folder.'
            : 'Zugriff auf den Ordner wurde nicht erteilt. Versuche es erneut oder wähle einen anderen Ordner.'
        );
      }
    } catch (err: any) {
      setError(err?.message || 'Could not reconnect folder.');
    }
  }, [language]);

  const handleSaveToLibrary = async () => {
    if (!currentImage) return;
    setError(null);
    try {
      const ready = await ensureLibraryFolder();
      if (!ready) return;
      const ts = Date.now();
      const { entry } = await saveImageToLibrary({
        dataUrl: currentImage,
        prompt: history[0]?.prompt || 'Saved Image',
        timestamp: ts,
      });
      setLibrary((prev) => [entry, ...prev]);
      setLastExportedImage(currentImage);
      alert(language === 'en' ? 'Saved to your library!' : 'In Ihrer Galerie gespeichert!');
    } catch (err: any) {
      if (err?.message === 'NO_LIBRARY_FOLDER') {
        setError(
          language === 'en'
            ? 'Pick a library folder first to save your visions on disk.'
            : 'Bitte zuerst einen Galerie-Ordner auswählen, um Visionen auf der Festplatte zu speichern.'
        );
        return;
      }
      console.error('Save to library failed:', err);
      setError(
        language === 'en'
          ? 'Could not save to library. Please try again.'
          : 'Speichern in der Galerie fehlgeschlagen. Bitte erneut versuchen.'
      );
    }
  };

  const removeFromLibrary = async (id: string) => {
    const target = library.find((item) => item.id === id);
    setLibrary((prev) => prev.filter((item) => item.id !== id));
    setThumbCache((prev) => {
      const url = prev[id];
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (target) {
      try {
        await deleteEntryFiles(target);
      } catch (err) {
        console.warn('Failed to delete files on disk:', err);
      }
    }
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('GEOLOCATION_UNSUPPORTED'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      });
    });
  };

  const handleAutoDetect = async () => {
    setError(null);
    setProcessing({ isProcessing: true, statusMessage: t.detectingLocation });
    try {
      const position = await getCurrentPosition();
      const detectedLocation = await reverseGeocodeLocation(
        position.coords.latitude,
        position.coords.longitude,
        language
      );

      if (!detectedLocation?.displayName) {
        throw new Error('LOCATION_NOT_FOUND');
      }

      setSearchQuery(detectedLocation.displayName);
    } catch (err: any) {
      if (err?.message === 'GEOLOCATION_UNSUPPORTED') {
        setError(t.locationUnavailable);
      } else if (err?.code === err?.PERMISSION_DENIED || err?.code === 1) {
        setError(t.locationPermissionDenied);
      } else {
        setError(t.locationNotFound);
      }
    } finally {
      setProcessing({ isProcessing: false });
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;
    setSearchQuery(query);
    setProcessing({ isProcessing: true, statusMessage: language === 'en' ? `Locating ${query}...` : `${query} wird gesucht...` });
    setError(null);
    try {
      let imageData: string | null = null;
      let source = language === 'en' ? 'Mapillary Real Image' : 'Echtes Bild';
      let mMeta: { link: string; capturedAt?: string } | null = null;
      let displayLocation = query;

      // 1. Try Mapillary
      setProcessing({ isProcessing: true, statusMessage: language === 'en' ? `Locating ${query}...` : `${query} wird gesucht...` });
      const geo = await geocodeBerlin(query);
      
      if (geo) {
        displayLocation = geo.displayName;
        setProcessing({ isProcessing: true, statusMessage: language === 'en' ? `Searching Mapillary near ${geo.displayName}...` : `Suche bei Mapillary in der Nähe von ${geo.displayName}...` });
        let mData = await fetchMapillaryImage(geo.lat, geo.lng);
        
        // Fuzzy Fallback: If specific address fails, try the street name
        if (!mData && query.match(/\d+/)) {
          const streetOnly = query.replace(/\d+/, '').trim();
          setProcessing({ isProcessing: true, statusMessage: language === 'en' ? `Address specific view not found. Trying ${streetOnly}...` : `Keine genaue Adresse gefunden. Versuche ${streetOnly}...` });
          const geoStreet = await geocodeBerlin(streetOnly);
          if (geoStreet) {
            mData = await fetchMapillaryImage(geoStreet.lat, geoStreet.lng);
          }
        }

        if (mData) {
          imageData = mData.url;
          source = language === 'en' ? 'Mapillary Real Image' : 'Echtes Bild';
          mMeta = { link: mData.link, capturedAt: mData.capturedAt };
        }
      }

      // 2. If Mapillary fails, stop (AI Visions removed)
      if (!imageData) {
        throw new Error(language === 'en' 
          ? `No street-level imagery found for "${query}". Try searching for major intersections or a nearby landmark.`
          : `Keine Straßenbilder für "${query}" gefunden. Versuchen Sie es mit großen Kreuzungen oder einer nahegelegenen Sehenswürdigkeit.`
        );
      }

      setOriginalImage(imageData);
      setCurrentImage(imageData);
      setImageSource(source);
      setFetchedLocation(displayLocation);
      setMapillaryMetadata(mMeta);
      setHistory([{ id: Date.now().toString(), dataUrl: imageData, prompt: `${source}: ${displayLocation}`, timestamp: Date.now() }]);
      setEditMode('comparison');
      navigate('/edit');
    } catch (err: any) {
      const isQuotaError = err.message?.toLowerCase().includes("429") || 
                           err.message?.toLowerCase().includes("quota") || 
                           JSON.stringify(err).includes("429");
      const isPermissionError = err.message?.toLowerCase().includes("403") || 
                               err.message?.toLowerCase().includes("permission denied") || 
                               JSON.stringify(err).includes("403");
      
      if (isQuotaError) {
        setError("AI Quota Exceeded. Please wait a moment and try again.");
      } else if (isPermissionError) {
        setError("Permission Denied. This feature requires a paid API key for preview models. Please click the key icon in the header to select a key.");
        setHasApiKey(false);
      } else if (err.message?.includes("Real imagery not found")) {
        setError(err.message);
      } else {
        setError(err.message || "Failed to generate street image.");
      }
    } finally {
      setProcessing({ isProcessing: false });
    }
  };

  const compositeImageWithMask = (originalBase64: string, transformedBase64: string, maskBase64: string): Promise<string> => {
    return new Promise((resolve) => {
      const original = new Image();
      const transformed = new Image();
      const mask = new Image();
      
      let loaded = 0;
      const checkLoaded = () => {
        loaded++;
        if (loaded === 3) {
          const canvas = document.createElement('canvas');
          canvas.width = original.width;
          canvas.height = original.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return resolve(transformedBase64);
          
          // 1. Draw original background
          ctx.drawImage(original, 0, 0);
          
          // 2. Prepare mask in memory with slight feathering for smooth blend
          const maskCanvas = document.createElement('canvas');
          maskCanvas.width = original.width;
          maskCanvas.height = original.height;
          const mctx = maskCanvas.getContext('2d');
          if (!mctx) return resolve(transformedBase64);
          
          mctx.drawImage(mask, 0, 0, maskCanvas.width, maskCanvas.height);

          // Soft matte: brush = rough placement reference; smooth alpha + wide blur blends into full frame
          const maskImageData = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          const pixels = maskImageData.data;
          for (let i = 0; i < pixels.length; i += 4) {
            const lum = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            const a =
              lum < 22 ? 0 : lum > 118 ? 255 : Math.round(((lum - 22) / (118 - 22)) * 255);
            pixels[i + 3] = a;
            pixels[i] = 255;
            pixels[i + 1] = 255;
            pixels[i + 2] = 255;
          }
          mctx.putImageData(maskImageData, 0, 0);

          const blurredMaskCanvas = document.createElement('canvas');
          blurredMaskCanvas.width = maskCanvas.width;
          blurredMaskCanvas.height = maskCanvas.height;
          const bmctx = blurredMaskCanvas.getContext('2d');
          if (bmctx) {
            const blurRadius = Math.max(6, Math.min(48, Math.round(original.width / 220)));
            bmctx.filter = `blur(${blurRadius}px)`;
            bmctx.drawImage(maskCanvas, 0, 0);
            bmctx.filter = 'none';
          }
          
          // 3. Draw transformed image only through the mask
          const transformedCanvas = document.createElement('canvas');
          transformedCanvas.width = original.width;
          transformedCanvas.height = original.height;
          const tctx = transformedCanvas.getContext('2d');
          if (!tctx) return resolve(transformedBase64);
          
          // Draw AI image, scaling it to match original dimensions if needed
          // Some AI models might return slightly different dimensions
          tctx.drawImage(transformed, 0, 0, transformedCanvas.width, transformedCanvas.height);
          
          // Apply mask
          tctx.globalCompositeOperation = 'destination-in';
          tctx.drawImage(blurredMaskCanvas || maskCanvas, 0, 0);
          
          // 4. Composite result on top of original
          ctx.globalCompositeOperation = 'source-over';
          ctx.drawImage(transformedCanvas, 0, 0);
          
          resolve(canvas.toDataURL('image/png'));
        }
      };
      
      const handleError = () => resolve(transformedBase64);
      
      original.onload = checkLoaded;
      transformed.onload = checkLoaded;
      mask.onload = checkLoaded;
      original.onerror = handleError;
      transformed.onerror = handleError;
      mask.onerror = handleError;
      
      original.src = originalBase64;
      transformed.src = transformedBase64;
      mask.src = maskBase64;
    });
  };

  const getBestAspectRatio = (imgUrl: string): Promise<"1:1" | "3:4" | "4:3" | "9:16" | "16:9"> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = img.width / img.height;
        if (ratio > 1.5) resolve("16:9");
        else if (ratio > 1.2) resolve("4:3");
        else if (ratio > 0.8) resolve("1:1");
        else if (ratio > 0.6) resolve("3:4");
        else resolve("9:16");
      };
      img.onerror = () => resolve("16:9");
      img.src = imgUrl;
    });
  };

  const handleTransform = async (prompt: string) => {
    if (!currentImage) return;
    
    setProcessing({ isProcessing: true, statusMessage: language === 'en' ? 'Synthesizing changes...' : 'Änderungen werden synthetisiert...' });
    setError(null);

    try {
      let maskForRun: string | null = null;
      if (editMode === 'mask') {
        const flushed = canvasRef.current?.getMaskDataUrl?.() ?? null;
        maskForRun = flushed || maskBase64;
        if (!maskForRun) {
          setError(
            language === 'en'
              ? 'Paint an area on the image first (Area Edit brush).'
              : 'Bitte zuerst einen Bereich mit dem Pinsel markieren (Bereich bearbeiten).',
          );
          return;
        }
      }

      const aspectRatio = await getBestAspectRatio(currentImage);
      const finalPrompt = buildTransformPrompt(prompt, { editMode });
      const newImageDataRaw = await transformImage(
        currentImage, 
        prompt, 
        editMode === 'mask' ? maskForRun : null,
        highQuality,
        aspectRatio
      );
      
      // OPTIMIZATION: If we used a mask, strictly composite the new data onto the original area
      // this prevents the AI from changing unmasked pixels like buildings.
      let finalImageData = newImageDataRaw;
      if (maskForRun) {
        try {
          finalImageData = await compositeImageWithMask(currentImage, newImageDataRaw, maskForRun);
        } catch (compErr) {
          console.warn("Mask composition failed, using raw AI output:", compErr);
        }
      }
      
      const label = editMode === 'mask' ? 'Area' : 'Full';
      const newImageEntry: GeneratedImage = {
        id: Date.now().toString(),
        dataUrl: finalImageData,
        prompt: editMode !== 'comparison' ? `${label}: ${prompt}` : prompt,
        timestamp: Date.now(),
      };
      
      setHistory((prev) => [newImageEntry, ...prev]);
      setCurrentImage(finalImageData);
      // Any transform creates a version that hasn't been saved/downloaded yet.
      // We intentionally do NOT clear lastExportedImage here; the comparison in
      // hasUnexportedChanges will handle the "dirty" state.
      
      // Reset tools
      setEditMode('comparison');
      setMaskBase64(null);
    } catch (err: any) {
      const isQuotaError = err.message?.toLowerCase().includes("429") || 
                           err.message?.toLowerCase().includes("quota") || 
                           JSON.stringify(err).includes("429");
      const isPermissionError = err.message?.toLowerCase().includes("403") || 
                               err.message?.toLowerCase().includes("permission denied") || 
                               JSON.stringify(err).includes("403");

      if (isQuotaError) {
        setError("AI Quota Exceeded. Please wait a moment and try again.");
      } else if (isPermissionError) {
        setError("Permission Denied. This feature requires a paid API key for preview models. Please click the key icon in the header to select a key.");
        setHasApiKey(false);
      } else {
        setError(err.message || "Failed to transform image");
      }
      throw err instanceof Error ? err : new Error(String(err));
    } finally {
      setProcessing({ isProcessing: false });
    }
  };

  const handleOverlayChange = useCallback((data: { mask?: string } | null) => {
    if (!data) {
      setMaskBase64(null);
    } else {
      if (data.mask) {
        setMaskBase64(data.mask);
      }
    }
  }, []);

  return (
    <div className="min-h-screen bg-eb-50 text-eb-900 font-sans selection:bg-eb-900 selection:text-eb-50">
      <header className="border-b-2 border-eb-900 bg-tsb sticky top-0 z-50">
        <div className="w-full px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button onClick={() => requestLeaveEditor('/')} className="bg-eb-50 p-0 h-10 w-10 flex items-center justify-center border-2 border-eb-900 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all overflow-hidden">
              <img src={kiezvisionLogoUrl} className="w-full h-full object-cover" alt="KiezVision Logo" />
            </button>
            <div>
              <h1 className="text-2xl font-black tracking-tighter leading-none mb-1 text-eb-50">KiezVision</h1>
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-black bg-coral-100 text-eb-900 px-2 py-0.5">{t.tagline}</span>
              </div>
            </div>
          </div>
          
          {view === 'editor' && originalImage && (
            <div className="flex items-center gap-2 bg-eb-50/15 p-1 border-2 border-eb-50/40 h-12">
              <button 
                onClick={() => setEditMode('comparison')} 
                className={`flex items-center gap-2 px-6 h-full text-xs font-black transition-all ${editMode === 'comparison' ? 'bg-coral-100 text-eb-900' : 'text-eb-50 hover:bg-white/10'}`}
              >
                <MousePointer2 className="w-4 h-4" /> {t.compare}
              </button>
              <button 
                onClick={() => {
                  setInpaintMountKey((k) => k + 1);
                  setEditMode('mask');
                }}
                className={`flex items-center gap-2 px-6 h-full text-xs font-black transition-all ${editMode === 'mask' ? 'bg-coral-100 text-eb-900' : 'text-eb-50 hover:bg-white/10'}`}
              >
                <Paintbrush2 className="w-4 h-4" /> {t.areaEdit}
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 h-10">
            <button 
              onClick={() => requestLeaveEditor('/library')}
              className={`flex items-center gap-2 px-6 h-full border-2 border-eb-900 text-xs font-black transition-all ${view === 'library' ? 'bg-eb-900 text-eb-50' : 'bg-eb-50 text-eb-900 hover:bg-coral-100 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)]'}`}
            >
              <Library className="w-4 h-4" /> <span className="hidden md:inline">{t.library}</span>
            </button>

            {view === 'editor' && currentImage && (
              <div className="flex items-center gap-2 h-full">
                <button 
                  onClick={handleSaveToLibrary} 
                  className="bg-eb-900 text-eb-50 px-6 h-full border-2 border-eb-900 text-xs font-black transition-all shadow-[4px_4px_0px_0px_rgba(254,68,65,0.35)] hover:shadow-none hover:bg-coral-500 flex items-center gap-2"
                >
                  <Save className="w-4 h-4" /> <span className="hidden lg:inline">{t.save}</span>
                </button>
                <button 
                  onClick={() => {
                    const date = new Date().toISOString().split('T')[0];
                    const street = (fetchedLocation || searchQuery).trim().replace(/[^a-z0-9]/gi, '_') || 'Street';
                    const filename = `Results_${date}_${street}.png`;
                    const a = document.createElement('a');
                    a.href = currentImage;
                    a.download = filename;
                    a.click();
                    setLastExportedImage(currentImage);
                  }} 
                  className="bg-eb-900 text-eb-50 px-4 h-full border-2 border-eb-900 text-xs font-black transition-all hover:bg-coral-500 flex items-center justify-center"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}

            <div className="flex items-center border-2 border-eb-900 bg-eb-50 overflow-hidden shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] h-full">
              <button 
                onClick={() => setLanguage('en')}
                className={`px-3 h-full text-[10px] font-black transition-all ${language === 'en' ? 'bg-eb-900 text-eb-50' : 'text-eb-900 hover:bg-coral-100'}`}
              >
                EN
              </button>
              <button 
                onClick={() => setLanguage('de')}
                className={`px-3 h-full text-[10px] font-black transition-all border-l-2 border-eb-900 ${language === 'de' ? 'bg-eb-900 text-eb-50' : 'text-eb-900 hover:bg-coral-100'}`}
              >
                DE
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full p-0 relative">
        {processing.isProcessing && view !== 'editor' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-eb-50 flex flex-col items-center justify-center text-center p-8 overflow-hidden"
          >
            {/* Pixel Leaf animation drawing */}
            <div className="flex items-center justify-center mb-12 scale-125">
              <PixelLeafLoader />
            </div>

            <div className="mb-6 relative z-20 mx-10">
                <h2 className="text-4xl font-black tracking-tighter uppercase italic text-eb-900">
                  {t.fetchingStreet}
                </h2>
            </div>
            
            <div className="flex flex-col gap-2 px-8 w-full max-w-md">
              <p className="text-xl font-bold text-eb-900 uppercase tracking-tight animate-pulse min-h-[3rem]">
                {processing.statusMessage}
              </p>
              
              <div className="w-full h-3 bg-eb-900/10 border-2 border-eb-900 relative overflow-hidden">
                <motion.div 
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 w-1/3 bg-coral-500"
                />
              </div>
            </div>

            <div className="mt-8 pt-8 border-t-2 border-eb-900/10 text-[10px] font-black text-eb-900/40">
              {t.tagline} • BLOCK_GEN_V2
            </div>
          </motion.div>
        )}

        {view === 'home' && (
          <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6 text-center max-w-5xl mx-auto overflow-y-auto">
            <div className="w-24 h-24 bg-white flex items-center justify-center mb-6 border-4 border-eb-900 shadow-[8px_8px_0px_0px_rgba(255,207,214,1)] rotate-3 overflow-hidden">
              <img src={kiezvisionLogoUrl} className="w-full h-full object-cover" alt="KiezVision Logo" />
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter leading-[0.9]">{t.reimagine}<br/>{t.yourStreet}</h2>
            <p className="text-eb-900/60 mb-6 max-w-2xl text-lg font-bold tracking-tight">{t.subtitle}</p>
            
            <div className="w-full space-y-8">
              <div className="bg-white border-4 border-eb-900 p-6 shadow-[12px_12px_0px_0px_rgba(32,32,27,1)]">
                <div className="flex justify-center mb-4">
                  <button
                    type="button"
                    onClick={handleAutoDetect}
                    disabled={processing.isProcessing}
                    className="px-4 h-10 text-[10px] font-black transition-all border-2 border-eb-900 bg-eb-900 text-eb-50 shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.autoDetect}
                  </button>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="relative">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full bg-gray-50 border-2 border-eb-900 h-16 px-6 pr-28 text-lg font-black tracking-tighter focus:bg-white outline-none transition-all placeholder:text-eb-900/20" disabled={processing.isProcessing} />
                  <button
                    type="submit"
                    disabled={!searchQuery.trim() || processing.isProcessing}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-coral-500 hover:bg-eb-900 text-eb-50 px-8 h-12 border-2 border-eb-900 font-black shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t.go}
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t-2 border-eb-900/10">
                  <h3 className="text-[9px] font-black text-eb-900 mb-4">{t.exploreDistricts}</h3>
                  <div className="flex flex-wrap justify-center gap-2">
                    {BERLIN_DISTRICTS.map(district => (
                      <button 
                        key={district}
                        onClick={() => handleSearch(district)}
                        className="px-3 h-9 border-2 border-eb-900 bg-white text-[10px] font-black hover:bg-eb-900 hover:text-eb-50 transition-all shadow-[2px_2px_0px_0px_rgba(32,32,27,0.1)] hover:shadow-none"
                      >
                        {district}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 text-center">
                <label className="group w-full sm:w-auto cursor-pointer bg-white text-eb-900 px-8 h-16 border-2 border-eb-900 shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-3 text-lg font-black tracking-tighter">
                  <Upload className="w-6 h-6" /> {t.uploadPhoto}
                  <input type="file" accept="image/*,.heic,.heif" multiple onChange={handleFileUpload} className="hidden" />
                </label>
                
                <button
                  type="button"
                  onClick={openDeviceCamera}
                  className="group w-full sm:w-auto cursor-pointer bg-white text-eb-900 px-8 h-16 border-2 border-eb-900 shadow-[6px_6px_0px_0px_rgba(254,68,65,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-3 text-lg font-black tracking-tighter"
                >
                  <Camera className="w-6 h-6" /> {t.capture}
                </button>
                <input
                  ref={cameraFileFallbackRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          </div>
        )}

        {view === 'library' && (
          <div className="max-w-7xl mx-auto p-12">
            <div className="flex flex-wrap items-end justify-between gap-6 mb-16 border-b-4 border-eb-900 pb-8">
              <div>
                <div className="mb-4">
                  <BackToHomeNavButton navigate={navigate} label={t.backToHome} />
                </div>
                <h2 className="text-6xl font-black tracking-tighter leading-none">{t.imageLibrary}</h2>
              </div>
              {folderStatus === 'unsupported' ? (
                <div className="flex items-center gap-2 px-4 h-10 border-2 border-eb-900 bg-white text-eb-900 text-[10px] font-black max-w-md">
                  <AlertCircle className="w-4 h-4" /> {t.browserUnsupportedFolder}
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 px-4 h-10 border-2 border-eb-900 text-[10px] font-black ${
                      folderStatus === 'connected'
                        ? 'bg-coral-100 text-eb-900'
                        : folderStatus === 'needs-permission'
                          ? 'bg-yellow-100 text-eb-900'
                          : 'bg-white text-eb-900'
                    }`}
                  >
                    {folderStatus === 'needs-permission' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <FolderOpen className="w-4 h-4" />
                    )}
                    {folderStatus === 'connected'
                      ? t.libraryFolderConnected
                      : folderStatus === 'needs-permission'
                        ? t.libraryFolderNeedsPermission
                        : t.libraryFolderDisconnected}
                  </div>
                  {folderStatus === 'needs-permission' ? (
                    <button
                      onClick={handleReconnectLibraryFolder}
                      className="flex items-center gap-2 px-4 h-10 border-2 border-eb-900 bg-eb-900 text-eb-50 text-[10px] font-black shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      <FolderOpen className="w-4 h-4" />
                      {t.reconnectLibraryFolder}
                    </button>
                  ) : (
                    <button
                      onClick={handleChooseLibraryFolder}
                      className="flex items-center gap-2 px-4 h-10 border-2 border-eb-900 bg-eb-900 text-eb-50 text-[10px] font-black shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      <FolderOpen className="w-4 h-4" />
                      {folderStatus === 'connected' ? t.changeLibraryFolder : t.chooseLibraryFolder}
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Reconnect prompt — shown when a folder was previously picked
                but the browser dropped permission (typical after a reload). */}
            {folderStatus === 'needs-permission' && (
              <div className="mb-10 bg-yellow-100 border-4 border-eb-900 p-6 shadow-[8px_8px_0px_0px_rgba(255,207,214,1)] flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center border-2 border-eb-900 bg-coral-100">
                    <AlertCircle className="w-5 h-5 text-eb-900" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tighter mb-1">{t.reconnectBannerTitle}</h3>
                    <p className="text-xs font-bold text-eb-900/70 leading-relaxed">{t.reconnectBannerSubtitle}</p>
                  </div>
                </div>
                <button
                  onClick={handleReconnectLibraryFolder}
                  className="flex-shrink-0 inline-flex items-center gap-2 bg-eb-900 text-eb-50 px-6 h-12 border-2 border-eb-900 text-xs font-black shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                >
                  <FolderOpen className="w-4 h-4" /> {t.reconnectLibraryFolder}
                </button>
              </div>
            )}

            {/* User Saved Section */}
            {library.filter(item => !item.id.startsWith('ex')).length === 0 ? (
              <div className="bg-white border-4 border-eb-900 p-12 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)] text-center">
                <div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center border-2 border-eb-900 bg-coral-100">
                  <Library className="w-8 h-8 text-eb-900" />
                </div>
                <h3 className="text-3xl font-black tracking-tighter mb-3">{t.libraryEmptyTitle}</h3>
                <p className="text-sm font-bold text-eb-900/70 max-w-xl mx-auto mb-8 leading-relaxed">
                  {t.libraryEmptySubtitle}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  {folderStatus === 'none' && (
                    <button
                      onClick={handleChooseLibraryFolder}
                      className="inline-flex items-center gap-3 bg-white text-eb-900 px-8 h-14 border-2 border-eb-900 text-xs font-black shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      <FolderOpen className="w-4 h-4" /> {t.chooseLibraryFolder}
                    </button>
                  )}
                  {folderStatus === 'needs-permission' && (
                    <button
                      onClick={handleReconnectLibraryFolder}
                      className="inline-flex items-center gap-3 bg-white text-eb-900 px-8 h-14 border-2 border-eb-900 text-xs font-black shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                    >
                      <FolderOpen className="w-4 h-4" /> {t.reconnectLibraryFolder}
                    </button>
                  )}
                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-3 bg-eb-900 text-eb-50 px-8 h-14 border-2 border-eb-900 text-xs font-black shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
                  >
                    <Wand2 className="w-4 h-4" /> {t.libraryEmptyCta}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4 mb-10">
                  <div className="bg-tsb text-eb-50 px-4 py-2 text-sm font-black">
                    {t.yourSavedVisions}
                  </div>
                  <div className="h-0.5 flex-1 bg-eb-900/10" />
                </div>
                {libraryByDate.map(([dateKey, entries]) => (
                  <div key={dateKey} className="mb-16 last:mb-0">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="border-2 border-eb-900 bg-white px-4 py-2 text-xs font-black tracking-tight">
                        {formatDateHeader(dateKey)}
                      </div>
                      <div className="text-[10px] font-black text-eb-900/40 uppercase tracking-widest">
                        {entries.length} {entries.length === 1 ? t.visionCountSingular : t.visionsCount}
                      </div>
                      <div className="h-0.5 flex-1 bg-eb-900/10" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                      {entries.map((item) => {
                    const thumb = thumbCache[item.id] ?? item.dataUrl ?? null;
                    const openInEditor = async () => {
                      setError(null);
                      const full = await loadFullImageDataUrl(item, { prompt: true });
                      if (!full) {
                        setError(t.folderUnavailable);
                        return;
                      }
                      setFolderStatus('connected');
                      setOriginalImage(full);
                      setCurrentImage(full);
                      setHistory([{ id: 'original', dataUrl: full, prompt: item.prompt, timestamp: item.timestamp }]);
                      setEditMode('comparison');
                      navigate('/edit');
                    };
                    const handleDownload = async () => {
                      setError(null);
                      const full = await loadFullImageDataUrl(item, { prompt: true });
                      if (!full) {
                        setError(t.folderUnavailable);
                        return;
                      }
                      setFolderStatus('connected');
                      const date = new Date(item.timestamp).toISOString().split('T')[0];
                      const slug = (item.prompt || 'KiezVision').replace(/[^a-z0-9]/gi, '_').slice(0, 60) || 'KiezVision';
                      const filename = `KiezVision_${date}_${slug}.png`;
                      const a = document.createElement('a');
                      a.href = full;
                      a.download = filename;
                      a.click();
                    };
                    return (
                      <div
                        key={item.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => { void openInEditor(); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            void openInEditor();
                          }
                        }}
                        className="group relative bg-white border-2 border-eb-900 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)] hover:shadow-none transition-all cursor-pointer focus:outline-none focus:ring-4 focus:ring-coral-500/40"
                        title={language === 'en' ? 'Open in Editor' : 'Im Editor öffnen'}
                      >
                        <div className="aspect-[4/3] w-full border-b-2 border-eb-900 overflow-hidden bg-gray-100">
                          {thumb ? (
                            <img src={thumb} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.prompt} />
                          ) : (
                            <div className="w-full h-full bg-gray-100 animate-pulse" />
                          )}
                        </div>
                        <div className="p-8">
                          <p className="text-[10px] font-black mb-6 border-l-4 border-eb-900 pl-4 leading-relaxed">{item.prompt}</p>
                          <div className="flex items-center gap-4">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void openInEditor();
                              }}
                              className="flex-1 bg-eb-900 text-eb-50 h-14 text-xs font-black hover:bg-coral-100 hover:text-eb-900 transition-all flex items-center justify-center gap-2"
                            >
                              <Wand2 className="w-4 h-4" /> {t.openInEditor}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void handleDownload();
                              }}
                              className="h-14 w-14 flex items-center justify-center bg-eb-900 text-eb-50 border-2 border-eb-900 hover:bg-coral-100 hover:text-eb-900 transition-all"
                              title={language === 'en' ? 'Download' : 'Herunterladen'}
                            >
                              <Download className="w-5 h-5" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeFromLibrary(item.id);
                              }}
                              className="h-14 w-14 flex items-center justify-center bg-red-600 text-eb-50 border-2 border-eb-900 hover:bg-eb-900 transition-all"
                              title={language === 'en' ? 'Delete' : 'Löschen'}
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {view === 'image-gallery' && (
          <div className="max-w-7xl mx-auto p-8 h-[calc(100vh-80px)] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between mb-10 border-b-4 border-eb-900 pb-6 flex-shrink-0">
              <div>
                <h2 className="text-5xl md:text-6xl font-black tracking-tighter leading-none">{t.imageGallery}</h2>
              </div>
            </div>

            {uploadedGallery.length === 0 ? (
              <div className="bg-white border-4 border-eb-900 p-10 shadow-[12px_12px_0px_0px_rgba(32,32,27,1)]">
                <p className="text-lg font-black tracking-tight text-eb-900">
                  {language === 'en'
                    ? 'No folder images loaded yet. Go back and select a folder.'
                    : 'Noch keine Ordnerbilder geladen. Gehen Sie zurück und wählen Sie einen Ordner.'}
                </p>
                <div className="mt-8">
                  <BackToHomeNavButton navigate={navigate} label={t.backToHome} />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-12 gap-8 flex-1 min-h-0 overflow-hidden">
                {/* Thumbnail Rail */}
                <div className="col-span-12 lg:col-span-3 min-h-0 overflow-hidden">
                  <div className="bg-white border-2 border-eb-900 shadow-[8px_8px_0px_0px_rgba(255,207,214,1)] overflow-hidden h-full flex flex-col min-h-0">
                    <div className="bg-tsb text-eb-50 px-4 py-2 text-[10px] font-black">
                      {language === 'en' ? 'Uploaded images' : 'Hochgeladene Bilder'} • {uploadedGallery.length}
                    </div>
                    <div className="overflow-y-auto custom-scrollbar p-4 flex flex-col gap-5 flex-1 min-h-0">
                      {uploadedGallery.map((img) => (
                        <button
                          key={img.id}
                          onClick={() => setSelectedGalleryId(img.id)}
                          className={`w-full h-28 sm:h-32 lg:h-36 flex-shrink-0 overflow-hidden transition-all ${
                            selectedGalleryId === img.id ? 'border-4 border-coral-500' : 'border-2 border-eb-900/20 hover:border-eb-900'
                          }`}
                          title={img.prompt}
                        >
                          <img src={img.dataUrl} className="w-full h-full object-cover" alt={img.prompt} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview + CTA */}
                <div className="col-span-12 lg:col-span-9 min-h-0 overflow-hidden">
                  {(() => {
                    const selected = uploadedGallery.find((x) => x.id === selectedGalleryId) || uploadedGallery[0];
                    return (
                      <div className="bg-white border-4 border-eb-900 shadow-[12px_12px_0px_0px_rgba(32,32,27,1)] overflow-hidden h-full flex flex-col min-h-0">
                        <div className="flex items-center justify-between gap-4 border-b-4 border-eb-900 p-5 bg-kv-chrome">
                          <div className="min-w-0">
                            <div className="text-[10px] font-black text-eb-900/60 uppercase tracking-widest">
                              {language === 'en' ? 'Selected' : 'Ausgewählt'}
                            </div>
                            <div className="text-lg md:text-xl font-black tracking-tighter truncate">
                              {selected?.prompt || (language === 'en' ? 'Image' : 'Bild')}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => selected && loadImageIntoEditor(selected.dataUrl, selected.prompt)}
                            className="bg-eb-900 text-eb-50 px-6 h-12 border-2 border-eb-900 text-xs font-black transition-all shadow-[4px_4px_0px_0px_rgba(254,68,65,0.35)] hover:shadow-none hover:bg-coral-500 flex items-center gap-2 whitespace-nowrap"
                          >
                            <Wand2 className="w-4 h-4" /> {t.editThisImage}
                          </button>
                        </div>
                        <div className="w-full bg-gray-100 flex-1 min-h-0">
                          {selected && (
                            <img src={selected.dataUrl} className="w-full h-full object-contain" alt={selected.prompt} />
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {view === 'editor' && originalImage && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 min-h-[calc(100vh-80px)] lg:h-[calc(100vh-80px)] lg:max-h-[calc(100vh-80px)]">
            <div className="order-1 lg:order-none col-span-12 lg:col-span-8 flex flex-col flex-1 min-h-0 w-full lg:h-full lg:max-h-full bg-white border-r-0 lg:border-r-2 border-eb-900">
              <div className="relative flex-1 min-h-[45vh] lg:min-h-0 bg-kv-chrome overflow-hidden">
                 {processing.isProcessing && (
                   <motion.div 
                     initial={{ opacity: 0 }}
                     animate={{ opacity: 1 }}
                     className="absolute inset-0 z-40 bg-eb-50 flex flex-col items-center justify-center text-center p-8"
                   >
                     <div className="flex items-center justify-center mb-6 scale-75">
                        <PixelLeafLoader />
                     </div>
                     <div className="text-eb-900 px-4 py-2 text-lg font-black tracking-tighter mb-2 italic uppercase">
                       {processing.statusMessage}
                     </div>
                     <div className="h-1 bg-eb-900 w-32 overflow-hidden shadow-[2px_2px_0_0_#FE4441]">
                        <motion.div 
                          animate={{ left: ['-100%', '100%'] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="relative h-full w-1/2 bg-coral-500"
                        />
                     </div>
                   </motion.div>
                 )}

                 <div className="absolute inset-0 min-h-0 bg-kv-chrome">
                  {editMode !== 'comparison' ? (
                    <InpaintCanvas 
                        key={inpaintMountKey}
                        ref={canvasRef}
                        image={currentImage || originalImage!} 
                        onOverlayChange={handleOverlayChange}
                        brushSize={brushSize}
                        isEraser={isAreaEditEraser}
                    />
                  ) : (
                    <BeforeAfterSlider 
                        originalImage={originalImage!} 
                        modifiedImage={currentImage || originalImage!} 
                    />
                  )}
                 </div>

                 {imageSource && !processing.isProcessing && (
                   <div className="absolute bottom-10 left-10 z-30 flex flex-col gap-2">
                     <div className="flex flex-col gap-0 border-2 border-eb-900 bg-white shadow-[6px_6px_0px_0px_rgba(32,32,27,1)]">
                       <div className="bg-tsb text-eb-50 px-3 py-1 text-[10px] font-black">
                         Source: {imageSource.includes('Mapillary') ? 'Photographic' : 'Synthetic'}
                       </div>
                       <div className="px-4 py-2">
                         <span className="text-xs font-black tracking-tighter">
                           {fetchedLocation || searchQuery || "Berlin Standard View"}
                         </span>
                       </div>
                     </div>
                     {mapillaryMetadata && (
                       <div className="flex flex-col gap-1.5">
                         <a 
                           href={mapillaryMetadata.link} 
                           target="_blank" 
                           rel="noreferrer" 
                           className="flex items-center gap-2 bg-coral-100 border-2 border-eb-900 px-4 py-2 text-[10px] font-black shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none transition-all w-fit"
                         >
                           External Imagery View
                         </a>
                       </div>
                     )}
                   </div>
                 )}
              </div>

              {/* Version History Footer Slider */}
              <div className="bg-white border-t-2 border-eb-900 p-6">
                <div className="flex items-center justify-between mb-4">
                   <h3 className="text-[11px] font-black flex items-center gap-2">
                     <History className="w-4 h-4" /> {t.iterations}
                   </h3>
                   <button onClick={() => { if(confirm(language === 'en' ? "Discard project?" : "Projekt verwerfen?")) window.location.reload(); }} className="text-[10px] font-black text-red-600 hover:text-red-700 transition-all">
                     {t.clearHistory}
                   </button>
                </div>
                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
                   {history.map((img, idx) => (
                    <button key={img.id} onClick={() => setCurrentImage(img.dataUrl)} className={`flex-shrink-0 relative w-40 border-2 transition-all text-left ${currentImage === img.dataUrl ? 'border-coral-500 ring-4 ring-coral-500/25 bg-eb-900' : 'border-eb-900/10 grayscale hover:grayscale-0 hover:border-eb-900'}`}>
                       <div className="aspect-[4/3] w-full bg-gray-100">
                         <img src={img.dataUrl} className="w-full h-full object-cover" alt={`V${history.length - idx}`} />
                       </div>
                       <div className="p-2 bg-white border-t-2 border-eb-900">
                          <p className={`text-[9px] font-black truncate leading-none ${currentImage === img.dataUrl ? 'text-eb-50' : 'text-eb-900'}`}>IDX_{history.length - idx} • {img.prompt}</p>
                       </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Sidebar Controls */}
            <div className="order-2 lg:order-none col-span-12 lg:col-span-4 w-full shrink-0 lg:h-full lg:min-h-0 bg-coral-500 flex flex-col p-8 overflow-y-auto custom-scrollbar border-t-2 lg:border-t-0 border-eb-900">
              <div className="mb-10 bg-tsb text-eb-50 p-4 shadow-[8px_8px_0px_0px_rgba(30,55,145,0.35)]">
                <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                  <Wand2 className="w-6 h-6" /> {t.toolkit}
                </h2>
              </div>

              <div className="space-y-10">
                {editMode === 'mask' && (
                    <div className="bg-white border-2 border-eb-900 p-6 shadow-[8px_8px_0px_0px_rgba(32,32,27,1)]">
                      <h3 className="text-xs font-black border-b-2 border-eb-900 pb-1 mb-6">{t.maskSettings}</h3>
                      <div className="flex items-center justify-between mb-6">
                        <h4 className="text-xs font-black border-b-2 border-eb-900 pb-1">{t.size}</h4>
                        <span className="font-mono text-xs bg-eb-900 text-eb-50 px-2 py-0.5">{brushSize}PX</span>
                      </div>
                      <input
                        type="range"
                        min="10"
                        max="150"
                        value={brushSize}
                        onChange={(e) => setBrushSize(parseInt(e.target.value))}
                        className="w-full h-6 accent-eb-900 appearance-none bg-gray-100 border border-eb-900 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-eb-900 [&::-webkit-slider-thumb]:rounded-none mb-6"
                      />
                      <div className="flex items-center gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => setIsAreaEditEraser(false)}
                          title={t.brush}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 border-2 border-eb-900 text-xs font-black transition-all ${
                            !isAreaEditEraser ? 'bg-coral-100 text-eb-900 shadow-[3px_3px_0_0_rgba(32,32,27,1)]' : 'bg-white text-eb-900 hover:bg-gray-50'
                          }`}
                        >
                          <Paintbrush2 className="w-4 h-4" aria-hidden /> {t.brush}
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAreaEditEraser(true)}
                          title={t.eraser}
                          className={`flex-1 flex items-center justify-center gap-2 py-3 border-2 border-eb-900 text-xs font-black transition-all ${
                            isAreaEditEraser ? 'bg-coral-500 text-eb-50 shadow-[3px_3px_0_0_rgba(32,32,27,1)]' : 'bg-white text-eb-900 hover:bg-gray-50'
                          }`}
                        >
                          <Eraser className="w-4 h-4" aria-hidden /> {t.eraser}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => canvasRef.current?.clear()}
                        className="w-full flex items-center justify-center gap-2 py-3 border-2 border-eb-900 bg-tsb text-eb-50 text-xs font-black shadow-[4px_4px_0_0_rgba(30,55,145,0.35)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all mb-4"
                      >
                        <RotateCcw className="w-4 h-4" aria-hidden /> {t.clearMask}
                      </button>
                      <p className="text-[10px] font-bold text-eb-900 tracking-tight leading-snug border-t border-eb-900/15 pt-4">
                        <span className="text-coral-500 font-black block mb-1">{t.areaEditTipTitle}</span>
                        {t.areaEditTipBody}
                      </p>
                    </div>
                )}

                <div className="bg-white border-2 border-eb-900 p-6 shadow-[8px_8px_0px_0px_rgba(32,32,27,1)]">
                  <h3 className="text-xs font-black border-b-2 border-eb-900 pb-1">{t.presets}</h3>
                  <QuickActions onAction={handleTransform} disabled={processing.isProcessing} language={language} />
                </div>
                
                <div className="bg-white border-2 border-eb-900 p-6 shadow-[8px_8px_0px_0px_rgba(32,32,27,1)]">
                  <h3 className="text-xs font-black border-b-2 border-eb-900 pb-1">{t.customCommand}</h3>
                  <TransformationPanel 
                    onTransform={handleTransform} 
                    isProcessing={processing.isProcessing} 
                    isMaskMode={editMode === 'mask'}
                    placeholder={editMode === 'mask' ? t.placeholderMask : t.placeholderEditor}
                    language={language}
                  />
                </div>
              </div>

              <div className="mt-12 text-[9px] font-black text-eb-900/50 border-t border-eb-900/20 pt-4 text-center">
                {t.tagline}
              </div>
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {cameraOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-eb-900/92 backdrop-blur-sm p-4"
          >
            <video
              ref={cameraVideoRef}
              className="w-full max-w-2xl max-h-[min(70vh,640px)] rounded-lg border-4 border-eb-50 object-cover bg-black"
              muted
              playsInline
              autoPlay
            />
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                onClick={closeCamera}
                className="px-8 h-14 border-2 border-eb-900 bg-eb-50 text-eb-900 text-sm font-black shadow-[4px_4px_0px_0px_rgba(254,68,65,0.4)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] hover:bg-coral-100 transition-all"
              >
                {t.cancelCamera}
              </button>
              <button
                type="button"
                onClick={capturePhotoFromVideo}
                className="px-8 h-14 border-2 border-eb-900 bg-coral-500 text-eb-50 text-sm font-black shadow-[4px_4px_0px_0px_rgba(250,250,242,0.4)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
              >
                {t.takePhoto}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaveEditorConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-eb-900/70 backdrop-blur-sm p-6"
          >
            <motion.div
              initial={{ y: 12, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 12, scale: 0.98, opacity: 0 }}
              className="w-full max-w-lg bg-white border-4 border-eb-900 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)]"
              role="dialog"
              aria-modal="true"
            >
              <div className="border-b-4 border-eb-900 bg-kv-chrome px-6 py-4">
                <h3 className="text-xl font-black tracking-tighter">
                  {language === 'en' ? 'Leave editor?' : 'Editor verlassen?'}
                </h3>
              </div>
              <div className="px-6 py-5">
                <p className="text-sm font-bold text-eb-900/80 leading-relaxed">
                  {language === 'en'
                    ? 'If you leave now, all changes will be lost unless you Save or Download.'
                    : 'Wenn Sie jetzt verlassen, gehen alle Änderungen verloren, sofern Sie nicht speichern oder herunterladen.'}
                </p>
              </div>
              <div className="px-6 pb-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowLeaveEditorConfirm(false);
                    setPendingPathAfterLeaveConfirm(null);
                  }}
                  className="px-6 h-12 border-2 border-eb-900 bg-white text-eb-900 text-xs font-black shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none hover:bg-coral-100 transition-all"
                >
                  {language === 'en' ? 'Cancel' : 'Abbrechen'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = pendingPathAfterLeaveConfirm || '/';
                    setShowLeaveEditorConfirm(false);
                    setPendingPathAfterLeaveConfirm(null);
                    navigate(next);
                  }}
                  className="px-6 h-12 border-2 border-eb-900 bg-eb-900 text-eb-50 text-xs font-black shadow-[4px_4px_0px_0px_rgba(254,68,65,0.35)] hover:shadow-none hover:bg-coral-500 transition-all"
                >
                  {language === 'en' ? 'Confirm' : 'Bestätigen'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {error && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-red-900/95 text-red-100 px-8 py-4 rounded-2xl border border-red-700 backdrop-blur-xl flex flex-col sm:flex-row items-center gap-4 animate-in slide-in-from-bottom-4 shadow-2xl z-[100] max-w-[90vw]">
          <div className="flex items-center gap-4">
            <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0" />
            <p className="text-sm font-bold tracking-tight">{error}</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setError(null)} className="text-eb-50 hover:bg-white/10 p-2 rounded-full transition-colors">✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
