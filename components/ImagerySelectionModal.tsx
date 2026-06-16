import React, { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import type { GeocodeResult, MapillaryCandidate } from "../services/mapillaryService";
import { fetchMapillaryCandidates } from "../services/mapillaryService";
import { toDisplayableDataUrl } from "../services/imageUtils";
import type { NormalizedCrop } from "../services/imageUtils";

const FULL_CROP: NormalizedCrop = { x: 0, y: 0, w: 1, h: 1 };

export interface ImagerySelectionConfirmPayload {
  previewDataUrl: string;
  crop: NormalizedCrop;
  location: GeocodeResult;
  displayLocation: string;
  sourceLabel: string;
  mapillaryMeta: { link: string; capturedAt?: string } | null;
}

export interface ImagerySelectionModalProps {
  open: boolean;
  initialLocation: GeocodeResult;
  initialCandidates: MapillaryCandidate[];
  initialSearchRadiusM: number;
  strings: {
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
  onClose: () => void;
  onConfirm: (payload: ImagerySelectionConfirmPayload) => void;
}

export const ImagerySelectionModal: React.FC<ImagerySelectionModalProps> = ({
  open,
  initialLocation,
  initialCandidates,
  initialSearchRadiusM,
  strings,
  onClose,
  onConfirm,
}) => {
  const [location, setLocation] = useState<GeocodeResult>(initialLocation);
  const [candidates, setCandidates] = useState<MapillaryCandidate[]>(initialCandidates);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialCandidates[0]?.id ?? null,
  );
  const [searchRadiusM, setSearchRadiusM] = useState(initialSearchRadiusM);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocation(initialLocation);
    setCandidates(initialCandidates);
    setSelectedId(initialCandidates[0]?.id ?? null);
    setSearchRadiusM(initialSearchRadiusM);
    setPreviewError(null);
    setPreviewUrl(null);
  }, [open, initialLocation, initialCandidates, initialSearchRadiusM]);

  const selectedCandidate = candidates.find((c) => c.id === selectedId);

  const loadPreviewFromUrl = useCallback(async (url: string) => {
    setLoadingPreview(true);
    setPreviewError(null);
    try {
      const dataUrl = await toDisplayableDataUrl(url);
      setPreviewUrl(dataUrl);
    } catch (e) {
      setPreviewUrl(null);
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!open || !selectedCandidate) return;
    void loadPreviewFromUrl(selectedCandidate.url);
  }, [open, selectedCandidate?.id, selectedCandidate?.url, loadPreviewFromUrl]);

  const refreshCandidates = async () => {
    setLoadingCandidates(true);
    setPreviewError(null);
    try {
      const lat = Number(location.lat);
      const lng = Number(location.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        throw new Error("Invalid coordinates");
      }
      const next = await fetchMapillaryCandidates(lat, lng, {
        searchRadiusM,
        limit: 12,
      });
      setCandidates(next);
      setSelectedId(next[0]?.id ?? null);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingCandidates(false);
    }
  };

  const handleConfirm = () => {
    if (!previewUrl) return;
    onConfirm({
      previewDataUrl: previewUrl,
      crop: FULL_CROP,
      location,
      displayLocation: location.displayName,
      sourceLabel: "Mapillary Real Image",
      mapillaryMeta: selectedCandidate
        ? { link: selectedCandidate.link, capturedAt: selectedCandidate.capturedAt }
        : null,
    });
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-eb-900/60"
      role="dialog"
      aria-modal="true"
      aria-labelledby="imagery-picker-title"
    >
      <div className="bg-eb-50 border-4 border-eb-900 shadow-[12px_12px_0px_0px_rgba(32,32,27,1)] w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-start justify-between gap-4 border-b-2 border-eb-900 p-4 bg-tsb text-eb-50">
          <div>
            <h2 id="imagery-picker-title" className="text-lg font-black tracking-tight">
              {strings.title}
            </h2>
            <p className="text-xs font-bold mt-1 opacity-90">{strings.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 border-2 border-eb-50 hover:bg-eb-900/20"
            aria-label={strings.cancel}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs font-black">
              {strings.lat}
              <input
                type="number"
                step="0.00001"
                value={location.lat}
                onChange={(e) =>
                  setLocation((l) => ({
                    ...l,
                    lat: parseFloat(e.target.value) || l.lat,
                  }))
                }
                className="mt-1 w-full border-2 border-eb-900 px-2 py-2 font-mono text-sm"
              />
            </label>
            <label className="text-xs font-black">
              {strings.lng}
              <input
                type="number"
                step="0.00001"
                value={location.lng}
                onChange={(e) =>
                  setLocation((l) => ({
                    ...l,
                    lng: parseFloat(e.target.value) || l.lng,
                  }))
                }
                className="mt-1 w-full border-2 border-eb-900 px-2 py-2 font-mono text-sm"
              />
            </label>
            <label className="text-xs font-black">
              {strings.searchRadius} ({searchRadiusM} m)
              <input
                type="range"
                min={50}
                max={800}
                step={25}
                value={searchRadiusM}
                onChange={(e) => setSearchRadiusM(parseInt(e.target.value, 10))}
                className="mt-2 w-full accent-eb-900"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => void refreshCandidates()}
            disabled={loadingCandidates}
            className="flex items-center gap-2 px-4 py-2 border-2 border-eb-900 bg-eb-900 text-eb-50 text-xs font-black disabled:opacity-50"
          >
            {loadingCandidates ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {strings.refresh}
          </button>
          {candidates.length === 0 ? (
            <p className="text-sm font-bold text-eb-900/70">{strings.noCandidates}</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[min(50vh,28rem)] overflow-y-auto">
              {candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedId(c.id)}
                  className={`text-left border-2 overflow-hidden ${
                    selectedId === c.id
                      ? "border-coral-500 ring-2 ring-coral-500"
                      : "border-eb-900 hover:border-tsb"
                  }`}
                >
                  <img
                    src={c.url}
                    alt=""
                    className="w-full aspect-video object-cover"
                  />
                  <span className="block px-2 py-1 text-[10px] font-black bg-white">
                    {Math.round(c.distanceM)} m {strings.distance}
                  </span>
                </button>
              ))}
            </div>
          )}
          {selectedCandidate && (
            <a
              href={selectedCandidate.link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-xs font-black underline"
            >
              <ExternalLink className="w-3 h-3" />
              {strings.openMapillary}
            </a>
          )}

          {previewError && (
            <p className="text-sm font-bold text-red-600">{previewError}</p>
          )}
        </div>

        <div className="flex gap-3 p-4 border-t-2 border-eb-900 bg-white">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 border-2 border-eb-900 text-xs font-black hover:bg-gray-100"
          >
            {strings.cancel}
          </button>
          <button
            type="button"
            disabled={!previewUrl || loadingPreview}
            onClick={handleConfirm}
            className="flex-1 py-3 border-2 border-eb-900 bg-coral-500 text-eb-50 text-xs font-black disabled:opacity-50 hover:bg-eb-900"
          >
            {strings.confirm}
          </button>
        </div>
      </div>
    </div>
  );
};
