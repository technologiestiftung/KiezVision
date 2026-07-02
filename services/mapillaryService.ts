import { GoogleGenAI, Type } from "@google/genai";
import { haversineDistanceM, offsetPointM } from "./geoUtils";
import { geocodeBerlinDistrict } from "./berlinDistricts";

const MAPILLARY_TOKEN = process.env.MAPILLARY_ACCESS_TOKEN;

const NOMINATIM_HEADERS = {
  "Accept-Language": "en",
  "User-Agent": "KiezVision/1.0 (urban-vision-transformer)",
};

const BERLIN_VIEWBOX = "13.088,52.338,13.761,52.675";

const getAiClient = () => {
  const apiKey =
    process.env.API_KEY ||
    process.env.CUSTOM_GEMINI_API_KEY ||
    process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("API Key not found");
  return new GoogleGenAI({ apiKey });
};

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
}

export interface ReverseGeocodeResult {
  displayName: string;
  lat: number;
  lng: number;
}

export interface MapillaryData {
  url: string;
  id: string;
  attribution: string;
  link: string;
  capturedAt?: string;
}

export interface MapillaryCandidate extends MapillaryData {
  lat: number;
  lng: number;
  distanceM: number;
  compassAngle?: number;
}

export const forwardGeocodeBerlin = async (
  query: string,
  language: "en" | "de" = "en",
): Promise<GeocodeResult | null> => {
  try {
    const params = new URLSearchParams({
      q: `${query.trim()}, Berlin, Germany`,
      format: "json",
      limit: "1",
      viewbox: BERLIN_VIEWBOX,
      bounded: "1",
      countrycodes: "de",
      "accept-language": language,
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      { headers: NOMINATIM_HEADERS },
    );
    if (!response.ok) return null;
    const results = await response.json();
    const hit = results?.[0];
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lng = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      displayName: hit.display_name?.split(",").slice(0, 2).join(",") || query,
    };
  } catch (error) {
    console.error("Nominatim geocode failed:", error);
    return null;
  }
};

export const geocodeBerlinWithGemini = async (
  query: string,
): Promise<GeocodeResult | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find the precise street-level latitude and longitude for "${query}" in Berlin, Germany. 
      Also provide a clean, short display name for this location (e.g. "Müllerstraße, Wedding").
      Return ONLY a JSON object with "lat", "lng", and "displayName" keys.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER },
            displayName: { type: Type.STRING },
          },
          required: ["lat", "lng", "displayName"],
        },
      },
    });
    return JSON.parse(response.text ?? "null");
  } catch (error) {
    console.error("Gemini geocoding failed:", error);
    return null;
  }
};

export const resolveGeocode = async (
  query: string,
  language: "en" | "de" = "en",
): Promise<GeocodeResult | null> => {
  const district = geocodeBerlinDistrict(query);
  if (district) return district;

  const nom = await forwardGeocodeBerlin(query, language);
  if (nom) return nom;
  return geocodeBerlinWithGemini(query);
};

export const geocodeBerlin = resolveGeocode;

export const reverseGeocodeLocation = async (
  lat: number,
  lng: number,
  language: "en" | "de" = "en",
): Promise<ReverseGeocodeResult | null> => {
  try {
    const params = new URLSearchParams({
      format: "jsonv2",
      lat: String(lat),
      lon: String(lng),
      addressdetails: "1",
      zoom: "18",
      "accept-language": language,
    });
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      { headers: NOMINATIM_HEADERS },
    );
    if (!response.ok) return null;

    const data = await response.json();
    const address = data.address ?? {};
    const street =
      address.road ||
      address.pedestrian ||
      address.footway ||
      address.cycleway ||
      address.path;
    if (!street) return null;

    const streetAddress = address.house_number
      ? `${street} ${address.house_number}`
      : street;
    const area =
      address.neighbourhood ||
      address.suburb ||
      address.borough ||
      address.city_district;
    const city = address.city || address.town || address.village || address.state;
    const context = area || city;

    return {
      displayName: context ? `${streetAddress}, ${context}` : streetAddress,
      lat,
      lng,
    };
  } catch (error) {
    console.error("Reverse geocoding failed:", error);
    return null;
  }
};

function pointFromGeometry(geom: unknown): { lat: number; lng: number } | null {
  if (!geom || typeof geom !== "object") return null;
  const g = geom as { type?: string; coordinates?: number[] };
  if (g.type === "Point" && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    return { lng: g.coordinates[0], lat: g.coordinates[1] };
  }
  return null;
}

function mapApiImageToCandidate(
  img: Record<string, unknown>,
  targetLat: number,
  targetLng: number,
): MapillaryCandidate | null {
  if (img.is_pano === true) return null;

  const id = String(img.id ?? "");
  const url = String(img.thumb_2048_url ?? img.thumb_1024_url ?? "");
  if (!id || !url) return null;

  const geom = pointFromGeometry(img.geometry ?? img.computed_geometry);
  const lat = geom?.lat ?? targetLat;
  const lng = geom?.lng ?? targetLng;
  const distanceM = haversineDistanceM(targetLat, targetLng, lat, lng);
  const captured = img.captured_at as number | undefined;

  return {
    id,
    url,
    lat,
    lng,
    distanceM,
    attribution: "Image from Mapillary",
    link: `https://www.mapillary.com/app/?pKey=${id}`,
    capturedAt: captured
      ? new Date(captured).toLocaleDateString()
      : undefined,
    compassAngle:
      typeof img.compass_angle === "number" ? img.compass_angle : undefined,
  };
}

const MAPILLARY_FETCH_TIMEOUT_MS = 20_000;
const MAPILLARY_MAX_RADIUS_M = 50;
const MAPILLARY_FIELDS =
  "id,thumb_1024_url,captured_at,compass_angle,geometry,is_pano";

function buildMapillaryRadiusUrl(
  lat: number,
  lng: number,
  limit: number,
): string {
  return `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&fields=${MAPILLARY_FIELDS}&lat=${lat}&lng=${lng}&radius=${MAPILLARY_MAX_RADIUS_M}&is_pano=false&limit=${Math.min(limit, 100)}`;
}

function imagerySearchPoints(
  lat: number,
  lng: number,
  searchRadiusM: number,
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [{ lat, lng }];
  if (searchRadiusM <= MAPILLARY_MAX_RADIUS_M) return points;

  const ringM = Math.min(Math.max(searchRadiusM - MAPILLARY_MAX_RADIUS_M, 40), 150);
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0.707, 0.707],
    [0, 1],
    [-0.707, 0.707],
    [-1, 0],
    [-0.707, -0.707],
    [0, -1],
    [0.707, -0.707],
  ];
  for (const [dx, dy] of dirs) {
    points.push(offsetPointM(lat, lng, dy * ringM, dx * ringM));
  }
  return points;
}

async function fetchMapillaryJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAPILLARY_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const data = (await response.json()) as Record<string, unknown>;
    if (!response.ok) {
      const err = data.error as { message?: string } | undefined;
      throw new Error(err?.message ?? `Mapillary HTTP ${response.status}`);
    }
    return data;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Mapillary request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMapillaryCandidates(
  targetLat: number,
  targetLng: number,
  options?: {
    searchRadiusM?: number;
    limit?: number;
  },
): Promise<MapillaryCandidate[]> {
  if (!MAPILLARY_TOKEN) {
    throw new Error("MAPILLARY_ACCESS_TOKEN missing");
  }

  const limit = options?.limit ?? 12;
  const searchRadiusM = options?.searchRadiusM ?? 120;
  const searchPoints = imagerySearchPoints(targetLat, targetLng, searchRadiusM);

  const seen = new Set<string>();
  const all: MapillaryCandidate[] = [];

  const fetchAtPoint = async (
    point: { lat: number; lng: number },
  ): Promise<MapillaryCandidate[]> => {
    const searchUrl = buildMapillaryRadiusUrl(point.lat, point.lng, limit);
    const data = await fetchMapillaryJson(searchUrl);
    const apiError = data.error as { message?: string } | undefined;
    if (apiError?.message) {
      throw new Error(apiError.message);
    }
    const batch: MapillaryCandidate[] = [];
    for (const img of (data.data as Record<string, unknown>[] | undefined) ?? []) {
      const c = mapApiImageToCandidate(img, targetLat, targetLng);
      if (c && c.distanceM <= searchRadiusM) batch.push(c);
    }
    return batch;
  };

  let lastError: unknown = null;
  for (const point of searchPoints) {
    if (all.length >= limit) break;
    try {
      const batch = await fetchAtPoint(point);
      for (const c of batch) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        all.push(c);
      }
    } catch (error) {
      lastError = error;
      console.error("Mapillary fetch failed:", error);
    }
  }

  if (all.length === 0 && lastError instanceof Error) {
    throw lastError;
  }

  return all.sort((a, b) => a.distanceM - b.distanceM).slice(0, limit);
}

export const fetchMapillaryImage = async (
  lat: number,
  lng: number,
): Promise<MapillaryData | null> => {
  const candidates = await fetchMapillaryCandidates(lat, lng, { limit: 1 });
  return candidates[0] ?? null;
};
