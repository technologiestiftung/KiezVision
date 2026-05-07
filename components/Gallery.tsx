import React from 'react';
import { GeneratedImage } from '../types';

interface GalleryProps {
  images: GeneratedImage[];
  onSelect: (image: GeneratedImage) => void;
  selectedId?: string;
}

// This component is replaced by the inline sidebar in App.tsx
// but we'll keep a simplified version if needed elsewhere.
export const Gallery: React.FC<GalleryProps> = () => null;