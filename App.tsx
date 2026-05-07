import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PixelLeafLoader } from './components/PixelLeafLoader';
import { 
  Upload, AlertCircle, Sparkles, Download, Building2, 
  History, RotateCcw, Search, MousePointer2, Paintbrush2, 
  Sliders, Wand2, Camera, Library, Save, ArrowLeft, Trash2, FolderOpen
} from 'lucide-react';
import { BeforeAfterSlider } from './components/BeforeAfterSlider';
import { InpaintCanvas } from './components/InpaintCanvas';
import { QuickActions } from './components/QuickActions';
import { TransformationPanel } from './components/TransformationPanel';
import { transformImage } from './services/geminiService';
import { geocodeBerlin, fetchMapillaryImage } from './services/mapillaryService';
import { GeneratedImage, ProcessingState } from './types';

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

const EXAMPLE_LIBRARY = [
  { id: 'ex1', dataUrl: 'https://images.unsplash.com/photo-1560930950-5cc20e80e392?auto=format&fit=crop&w=1200&q=80', prompt: '[Mapillary] Berlin Mitte: Alexanderplatz approach', timestamp: Date.now() },
];

export default function App() {
  const [view, setView] = useState<'home' | 'editor' | 'library' | 'image-gallery'>('home');
  const [language, setLanguage] = useState<'en' | 'de'>('en');

  const t = {
    en: {
      tagline: "Berlin Transformation Lab",
      subtitle: "Envision a greener, car-free future using real Mapillary imagery or AI visions.",
      reimagine: "Reimagine",
      yourStreet: "Your Street",
      searchPlaceholder: "Search for a street (e.g. Kurfürstendamm)...",
      autoDetect: "Auto Detect",
      realPhotos: "Street Image",
      go: "GO",
      exploreDistricts: "Explore Districts",
      uploadPhoto: "Upload Photo",
      openFolder: "Open Folder",
      capture: "Capture",
      library: "Library",
      backToHome: "Back to Home",
      imageLibrary: "Image Library",
      imageGallery: "Image Gallery",
      editThisImage: "Edit this image",
      featuredStreets: "Featured Berlin Streets",
      yourSavedVisions: "Your Saved Visions",
      openInEditor: "Open in Editor",
      startTransformation: "Start Transformation",
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
      synthesizing: "Synthesizing...",
      iterations: "Model Iterations",
      sourceMapillary: "Mapillary Real Image",
      sourceAI: "AI Generated",
      realPhoto: "real photo",
      aiVision: "AI vision",
      takePhoto: "Take photo",
      cancelCamera: "Cancel",
    },
    de: {
      tagline: "Berlin Transformations-Labor",
      subtitle: "Stellen Sie sich eine grünere, autofreie Zukunft vor, basierend auf echten Mapillary-Bildern oder KI-Visionen.",
      reimagine: "Ihre Straße",
      yourStreet: "neu denken",
      searchPlaceholder: "Nach einer Straße suchen (z.B. Kurfürstendamm)...",
      autoDetect: "Auto-Erkennung",
      realPhotos: "Straßenbild",
      go: "LOS",
      exploreDistricts: "Bezirke erkunden",
      uploadPhoto: "Foto hochladen",
      openFolder: "Ordner öffnen",
      capture: "Aufnehmen",
      library: "Galerie",
      backToHome: "Zurück zum Start",
      imageLibrary: "Bildgalerie",
      imageGallery: "Bildergalerie",
      editThisImage: "Dieses Bild bearbeiten",
      featuredStreets: "Ausgewählte Berliner Straßen",
      yourSavedVisions: "Ihre gespeicherten Visionen",
      openInEditor: "Im Editor öffnen",
      startTransformation: "Transformation starten",
      compare: "Vergleichen",
      areaEdit: "Bereich bearbeiten",
      save: "Speichern",
      fetchingStreet: "Suche deine Straße...",
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
  const [library, setLibrary] = useState<GeneratedImage[]>(() => {
    const saved = localStorage.getItem('kiezvision_library');
    return saved ? JSON.parse(saved) : EXAMPLE_LIBRARY;
  });
  const [uploadedGallery, setUploadedGallery] = useState<GeneratedImage[]>([]);
  const [selectedGalleryId, setSelectedGalleryId] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false });
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'auto' | 'real'>('auto');
  const [imageSource, setImageSource] = useState<string | null>(null);
  const [fetchedLocation, setFetchedLocation] = useState<string | null>(null);
  const [mapillaryMetadata, setMapillaryMetadata] = useState<{ link: string; capturedAt?: string } | null>(null);
  
  // Editor States
  const [editMode, setEditMode] = useState<'comparison' | 'mask'>('comparison');
  const [maskBase64, setMaskBase64] = useState<string | null>(null);
  const [brushSize, setBrushSize] = useState(40);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [highQuality, setHighQuality] = useState(false);
  const canvasRef = useRef<any>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const cameraFileFallbackRef = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const setRoute = useCallback((nextView: typeof view) => {
    const nextPath =
      nextView === 'image-gallery'
        ? '/image-gallery'
        : nextView === 'library'
          ? '/library'
          : nextView === 'editor'
            ? '/editor'
            : '/';

    if (window.location.pathname !== nextPath) {
      window.history.pushState({}, '', nextPath);
    }
    setView(nextView);
  }, []);

  useEffect(() => {
    const syncFromPath = () => {
      const path = window.location.pathname || '/';
      if (path === '/image-gallery') setView('image-gallery');
      else if (path === '/library') setView('library');
      else if (path === '/editor') setView('editor');
      else setView('home');
    };
    syncFromPath();
    window.addEventListener('popstate', syncFromPath);
    return () => window.removeEventListener('popstate', syncFromPath);
  }, []);

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
      setRoute('editor');
    },
    [setRoute]
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

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  useEffect(() => {
    localStorage.setItem('kiezvision_library', JSON.stringify(library));
  }, [library]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcessing({ isProcessing: true, statusMessage: 'Processing your image...' });
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      loadImageIntoEditor(result, 'Original Upload');
      setProcessing({ isProcessing: false });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files: File[] = e.target.files ? Array.from(e.target.files) : [];
    if (!files.length) return;

    setProcessing({ isProcessing: true, statusMessage: language === 'en' ? 'Processing your images...' : 'Bilder werden verarbeitet...' });
    setError(null);

    try {
      const imageFiles = files
        .filter((f) => f.type.startsWith('image/'))
        .sort((a, b) => {
          const aLabel = (a as File & { webkitRelativePath?: string }).webkitRelativePath || a.name;
          const bLabel = (b as File & { webkitRelativePath?: string }).webkitRelativePath || b.name;
          return aLabel.localeCompare(bLabel);
        });

      const readAsDataUrl = (file: File) =>
        new Promise<string>((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(r.result as string);
          r.onerror = () => reject(new Error('Failed to read file'));
          r.readAsDataURL(file);
        });

      const entries: GeneratedImage[] = [];
      for (const file of imageFiles) {
        const dataUrl = await readAsDataUrl(file);
        const label = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
        entries.push({
          id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
          dataUrl,
          prompt: label,
          timestamp: Date.now(),
        });
      }

      setUploadedGallery(entries);
      setSelectedGalleryId(entries[0]?.id ?? null);
      setRoute('image-gallery');
    } catch (err: any) {
      setError(err?.message || 'Failed to process folder upload.');
    } finally {
      setProcessing({ isProcessing: false });
      e.target.value = '';
    }
  };

  const handleSaveToLibrary = () => {
    if (!currentImage) return;
    const newEntry: GeneratedImage = {
      id: Date.now().toString(),
      dataUrl: currentImage,
      prompt: history[0]?.prompt || 'Saved Image',
      timestamp: Date.now()
    };
    setLibrary(prev => [newEntry, ...prev]);
    alert("Saved to your library!");
  };

  const removeFromLibrary = (id: string) => {
    setLibrary(prev => prev.filter(item => item.id !== id));
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
      setView('editor');
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
          
          // Use filter for simple feathering
          mctx.drawImage(mask, 0, 0, maskCanvas.width, maskCanvas.height);
          
          // Convert binary mask (Black/White) to alpha mask (Transparent/Opaque)
          const maskImageData = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
          const pixels = maskImageData.data;
          for (let i = 0; i < pixels.length; i += 4) {
            const brightness = (pixels[i] + pixels[i+1] + pixels[i+2]) / 3;
            // Set alpha based on brightness (White => 255, Black => 0)
            pixels[i+3] = brightness > 50 ? 255 : 0;
            // Also ensure the pixel is white for the destination-in operation
            pixels[i] = 255;
            pixels[i+1] = 255;
            pixels[i+2] = 255;
          }
          mctx.putImageData(maskImageData, 0, 0);

          // Apply slight blur to the mask now that it has alpha
          const blurredMaskCanvas = document.createElement('canvas');
          blurredMaskCanvas.width = maskCanvas.width;
          blurredMaskCanvas.height = maskCanvas.height;
          const bmctx = blurredMaskCanvas.getContext('2d');
          if (bmctx) {
            // Minimal blur for sharp edges (approx 0.3% of width)
            const blurRadius = Math.max(1, Math.round(original.width / 800));
            bmctx.filter = `blur(${blurRadius}px)`;
            bmctx.drawImage(maskCanvas, 0, 0);
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
      const aspectRatio = await getBestAspectRatio(currentImage);
      const newImageDataRaw = await transformImage(
        currentImage, 
        prompt, 
        editMode === 'mask' ? maskBase64 : null,
        highQuality,
        aspectRatio
      );
      
      // OPTIMIZATION: If we used a mask, strictly composite the new data onto the original area
      // this prevents the AI from changing unmasked pixels like buildings.
      let finalImageData = newImageDataRaw;
      const activeMask = editMode === 'mask' ? maskBase64 : null;
      if (activeMask) {
        try {
          finalImageData = await compositeImageWithMask(currentImage, newImageDataRaw, activeMask);
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
            <button onClick={() => setRoute('home')} className="bg-eb-50 p-0 h-10 w-10 flex items-center justify-center border-2 border-eb-900 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all overflow-hidden">
              <img src="/src/assets/images/kiezvision_logo_1777989140951.png" className="w-full h-full object-cover" alt="KiezVision Logo" />
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
                onClick={() => setEditMode('mask')} 
                className={`flex items-center gap-2 px-6 h-full text-xs font-black transition-all ${editMode === 'mask' ? 'bg-coral-100 text-eb-900' : 'text-eb-50 hover:bg-white/10'}`}
              >
                <Paintbrush2 className="w-4 h-4" /> {t.areaEdit}
              </button>
            </div>
          )}

          <div className="flex items-center gap-4 h-10">
            <button 
              onClick={() => setRoute('library')}
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
              <img src="/src/assets/images/kiezvision_logo_1777989140951.png" className="w-full h-full object-cover" alt="KiezVision Logo" />
            </div>
            <h2 className="text-4xl md:text-6xl font-black mb-4 tracking-tighter leading-[0.9]">{t.reimagine}<br/>{t.yourStreet}</h2>
            <p className="text-eb-900/60 mb-6 max-w-2xl text-lg font-bold tracking-tight">{t.subtitle}</p>
            
            <div className="w-full space-y-8">
              <div className="bg-white border-4 border-eb-900 p-6 shadow-[12px_12px_0px_0px_rgba(32,32,27,1)]">
                <div className="flex justify-center mb-4">
                  <div className="flex items-center border-2 border-eb-900 bg-white overflow-hidden shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] h-10">
                    <button
                      type="button"
                      onClick={() => setSearchMode('auto')}
                      className={`px-4 h-full text-[10px] font-black transition-all ${
                        searchMode === 'auto' ? 'bg-eb-900 text-eb-50' : 'text-eb-900 hover:bg-coral-100'
                      }`}
                    >
                      {t.autoDetect}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchMode('real')}
                      className={`px-4 h-full text-[10px] font-black transition-all border-l-2 border-eb-900 ${
                        searchMode === 'real' ? 'bg-eb-900 text-eb-50' : 'text-eb-900 hover:bg-coral-100'
                      }`}
                    >
                      {t.realPhotos}
                    </button>
                  </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="relative">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t.searchPlaceholder} className="w-full bg-gray-50 border-2 border-eb-900 h-16 px-6 text-lg font-black tracking-tighter focus:bg-white outline-none transition-all placeholder:text-eb-900/20" disabled={processing.isProcessing} />
                  <button type="submit" disabled={!searchQuery.trim() || processing.isProcessing} className="absolute right-2 top-1/2 -translate-y-1/2 bg-coral-500 hover:bg-eb-900 text-eb-50 px-8 h-12 border-2 border-eb-900 font-black shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] transition-all">{t.go}</button>
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
                  <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                </label>

                <label className="group w-full sm:w-auto cursor-pointer bg-white text-eb-900 px-8 h-16 border-2 border-eb-900 shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all flex items-center justify-center gap-3 text-lg font-black tracking-tighter">
                  <FolderOpen className="w-6 h-6" /> {t.openFolder}
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    {...({ webkitdirectory: '', directory: '' } as any)}
                    onChange={handleFolderUpload}
                    className="hidden"
                  />
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
            <div className="flex items-center justify-between mb-16 border-b-4 border-eb-900 pb-8">
              <div>
                <button onClick={() => setRoute('home')} className="flex items-center gap-2 text-eb-900 font-black mb-4 border-2 border-eb-900 px-4 h-10 bg-coral-100 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none transition-all">
                  <ArrowLeft className="w-4 h-4" /> {t.backToHome}
                </button>
                <h2 className="text-6xl font-black tracking-tighter leading-none">{t.imageLibrary}</h2>
              </div>
            </div>

            {/* Featured Section */}
            <div className="mb-20">
              <div className="flex items-center gap-4 mb-10">
                <div className="bg-tsb text-eb-50 px-4 py-2 text-sm font-black">
                  {t.featuredStreets}
                </div>
                <div className="h-0.5 flex-1 bg-eb-900/10" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                {EXAMPLE_LIBRARY.map((item) => (
                  <div key={item.id} className="group relative bg-white border-2 border-eb-900 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)] hover:shadow-none transition-all">
                    <div className="aspect-[4/3] w-full border-b-2 border-eb-900 overflow-hidden bg-gray-100">
                      <img src={item.dataUrl} className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500" alt={item.prompt} />
                    </div>
                    <div className="p-8">
                      <p className="text-[10px] font-black text-eb-900 mb-6 border-l-4 border-eb-900 pl-4 leading-relaxed">{item.prompt}</p>
                      <button 
                        onClick={() => {
                          setProcessing({ isProcessing: true, statusMessage: t.loading });
                          setTimeout(() => {
                            setOriginalImage(item.dataUrl);
                            setCurrentImage(item.dataUrl);
                            setHistory([{ ...item, id: 'original' }]);
                            setRoute('editor');
                            setEditMode('comparison');
                            setImageSource(t.sourceMapillary);
                            setProcessing({ isProcessing: false });
                          }, 500);
                        }}
                        className="w-full bg-eb-900 text-eb-50 h-14 text-xs font-black hover:bg-coral-500 transition-all flex items-center justify-center gap-3"
                      >
                        <Wand2 className="w-5 h-5" /> {t.startTransformation}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* User Saved Section */}
            {library.filter(item => !item.id.startsWith('ex')).length > 0 && (
              <div>
                <div className="flex items-center gap-4 mb-10">
                  <div className="bg-tsb text-eb-50 px-4 py-2 text-sm font-black">
                    {t.yourSavedVisions}
                  </div>
                  <div className="h-0.5 flex-1 bg-eb-900/10" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12">
                  {library.filter(item => !item.id.startsWith('ex')).map((item) => (
                    <div key={item.id} className="group relative bg-white border-2 border-eb-900 shadow-[12px_12px_0px_0px_rgba(254,68,65,1)] hover:shadow-none transition-all">
                      <div className="aspect-[4/3] w-full border-b-2 border-eb-900 overflow-hidden bg-gray-100">
                        <img src={item.dataUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt={item.prompt} />
                      </div>
                      <div className="p-8">
                        <p className="text-[10px] font-black mb-6 border-l-4 border-eb-900 pl-4 leading-relaxed">{item.prompt}</p>
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => {
                              setOriginalImage(item.dataUrl);
                              setCurrentImage(item.dataUrl);
                              setHistory([{ ...item, id: 'original' }]);
                              setRoute('editor');
                              setEditMode('comparison');
                            }}
                            className="flex-1 bg-eb-900 text-eb-50 h-14 text-xs font-black hover:bg-coral-100 hover:text-eb-900 transition-all"
                          >
                            {t.openInEditor}
                          </button>
                          <button 
                            onClick={() => removeFromLibrary(item.id)}
                            className="h-14 w-14 flex items-center justify-center bg-red-600 text-eb-50 border-2 border-eb-900 hover:bg-eb-900 transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
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
          <div className="grid grid-cols-12 h-[calc(100vh-80px)] min-h-0">
            <div className="col-span-12 lg:col-span-8 flex flex-col h-full min-h-0 bg-white border-r-2 border-eb-900">
              <div className="relative flex-1 min-h-0 bg-kv-chrome overflow-hidden">
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
                        ref={canvasRef}
                        image={currentImage || originalImage!} 
                        onOverlayChange={handleOverlayChange}
                        brushSize={brushSize}
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
                   <button onClick={() => { if(confirm(language === 'en' ? "Discard project?" : "Projekt verwerfen?")) window.location.reload(); }} className="text-[10px] font-black text-eb-900/40 hover:text-red-600 transition-all">
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
            <div className="col-span-12 lg:col-span-4 h-full bg-coral-500 flex flex-col p-8 overflow-y-auto custom-scrollbar border-t-2 lg:border-t-0 border-eb-900">
              <div className="mb-10 bg-tsb text-eb-50 p-4 shadow-[8px_8px_0px_0px_rgba(30,55,145,0.35)]">
                <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
                  <Wand2 className="w-6 h-6" /> {t.toolkit}
                </h2>
              </div>

              <div className="space-y-10">
                {editMode === 'mask' && (
                <div className="bg-white border-2 border-eb-900 p-6 shadow-[8px_8px_0px_0px_rgba(32,32,27,1)]">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black border-b-2 border-eb-900 pb-1">{t.size}</h3>
                    <span className="font-mono text-xs bg-eb-900 text-eb-50 px-2 py-0.5">{brushSize}PX</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="150" 
                    value={brushSize} 
                    onChange={(e) => setBrushSize(parseInt(e.target.value))} 
                    className="w-full h-6 accent-eb-900 appearance-none bg-gray-100 border border-eb-900 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-eb-900 [&::-webkit-slider-thumb]:rounded-none" 
                  />
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
                className="px-8 h-14 border-2 border-eb-50 bg-transparent text-eb-50 text-sm font-black hover:bg-eb-50/10 transition-all"
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
