import { GoogleGenAI, Type } from "@google/genai";

const MAPILLARY_TOKEN = process.env.MAPILLARY_ACCESS_TOKEN;

const getAiClient = () => {
  const apiKey = process.env.API_KEY || process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
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

/**
 * Uses Gemini to resolve a street name/district in Berlin to coordinates.
 */
export const geocodeBerlin = async (query: string): Promise<GeocodeResult | null> => {
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

    return JSON.parse(response.text);
  } catch (error) {
    console.error("Geocoding failed:", error);
    return null;
  }
};

/**
 * Uses OpenStreetMap's reverse geocoder to turn browser coordinates into a
 * street-level search label, including the house number when available.
 */
export const reverseGeocodeLocation = async (
  lat: number,
  lng: number,
  language: 'en' | 'de' = 'en'
): Promise<ReverseGeocodeResult | null> => {
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      addressdetails: '1',
      zoom: '18',
      'accept-language': language,
    });
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`);
    if (!response.ok) return null;

    const data = await response.json();
    const address = data.address ?? {};
    const street = address.road || address.pedestrian || address.footway || address.cycleway || address.path;
    if (!street) return null;

    const streetAddress = address.house_number ? `${street} ${address.house_number}` : street;
    const area = address.neighbourhood || address.suburb || address.borough || address.city_district;
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

export interface MapillaryData {
  url: string;
  id: string;
  attribution: string;
  link: string;
  capturedAt?: string;
}

/**
 * Fetches a street-level image from Mapillary near the given coordinates.
 * Implements a deep stepped search radius to find the nearest coverage.
 */
export const fetchMapillaryImage = async (lat: number, lng: number): Promise<MapillaryData | null> => {
  if (!MAPILLARY_TOKEN) {
    console.warn("Mapillary token missing");
    return null;
  }

  // Try multiple radii: 50m, 200m, 500m, 1km, 1.5km
  const radii = [0.0005, 0.002, 0.005, 0.01, 0.015];

  for (const delta of radii) {
    try {
      const bbox = `${lng - delta},${lat - delta},${lng + delta},${lat + delta}`;
      // Fetch multiple to find the best/most recent one
      const searchUrl = `https://graph.mapillary.com/images?access_token=${MAPILLARY_TOKEN}&fields=id,thumb_2048_url,captured_at,compass_angle,is_pano&bbox=${bbox}&is_pano=false&limit=5`;
      
      const response = await fetch(searchUrl);
      const data = await response.json();

      if (data.data && data.data.length > 0) {
        // Sort by capture date (newest first)
        const sorted = data.data.sort((a: any, b: any) => b.captured_at - a.captured_at);
        const img = sorted[0];
        
        return {
          url: img.thumb_2048_url,
          id: img.id,
          attribution: "Image from Mapillary",
          link: `https://www.mapillary.com/app/?pKey=${img.id}`,
          capturedAt: img.captured_at ? new Date(img.captured_at).toLocaleDateString() : undefined
        };
      }
    } catch (error) {
      console.error(`Mapillary fetch failed at delta ${delta}:`, error);
    }
  }

  return null;
};
