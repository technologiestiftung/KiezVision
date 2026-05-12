export interface GeneratedImage {
  id: string;
  dataUrl: string; // Base64 or URL
  prompt: string;
  timestamp: number;
}

// A library entry references images written to a user-picked folder on disk
// via the File System Access API. The actual PNG/thumbnail bytes live on
// disk; localStorage only ever holds this small metadata record.
export interface LibraryEntry {
  id: string;
  prompt: string;
  timestamp: number;
  folder: string;        // e.g. "2026-05-07"
  filename: string;      // e.g. "vision-1715074321.png"
  thumbFilename: string; // e.g. "vision-1715074321.thumb.jpg"
  // Optional legacy fallback: data URL kept inline for entries created before
  // the on-disk library existed. When present, on-disk fields may be empty.
  dataUrl?: string;
}

export enum TransformationType {
  ADD_TREES = 'Transform into an eco-city with lush green trees lining the street, vertical gardens on buildings, and planters',
  ADD_WATER = 'Replace the street road with a clear blue water canal, creating a Venice-like urban waterway',
  REMOVE_CARS = 'Remove all cars, trucks, and vehicles from the street, making it a pedestrian-only zone with clean pavement',
  SUNNY_DAY = 'Make the scene bright and sunny with a clear blue sky, warm sunlight, and clear natural shadows, as if it is a beautiful summer afternoon',
  ADD_BENCH = 'Add one or more realistic public park benches along the sidewalk or plaza, matching the local street style and materials',
  ADD_BIKE_RACK = 'Add practical bicycle parking such as metal U-racks or staple racks on the sidewalk, spaced realistically for several bikes',
  CUSTOM = 'Custom'
}

export interface ProcessingState {
  isProcessing: boolean;
  statusMessage?: string;
}