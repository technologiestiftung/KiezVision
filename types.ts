export interface GeneratedImage {
  id: string;
  dataUrl: string; // Base64 or URL
  prompt: string;
  timestamp: number;
}

export enum TransformationType {
  ADD_TREES = 'Transform into an eco-city with lush green trees lining the street, vertical gardens on buildings, and planters',
  ADD_WATER = 'Replace the street road with a clear blue water canal, creating a Venice-like urban waterway',
  REMOVE_CARS = 'Remove all cars, trucks, and vehicles from the street, making it a pedestrian-only zone with clean pavement',
  SUNNY_DAY = 'Make the scene bright and sunny with a clear blue sky, warm sunlight, and soft shadows, as if it is a beautiful summer afternoon',
  CUSTOM = 'Custom'
}

export interface ProcessingState {
  isProcessing: boolean;
  statusMessage?: string;
}