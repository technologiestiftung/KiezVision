import React, { useState, useRef, useEffect, useLayoutEffect, useCallback, type KeyboardEvent } from 'react';
import { GripVertical } from 'lucide-react';

interface BeforeAfterSliderProps {
  originalImage: string;
  modifiedImage: string;
  className?: string;
  labelBefore?: string;
  labelAfter?: string;
  ariaLabelSlider?: string;
}

/** Same cover logic as InpaintCanvas — image fills container; overflow cropped center. */
function getCoverStageSize(
  cw: number,
  ch: number,
  iw: number,
  ih: number
): { width: number; height: number } {
  if (!cw || !ch || !iw || !ih) {
    return { width: 0, height: 0 };
  }
  const scale = Math.max(cw / iw, ch / ih);
  return { width: iw * scale, height: ih * scale };
}

export const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({
  originalImage,
  modifiedImage,
  className = '',
  labelBefore = 'BEFORE',
  labelAfter = 'AFTER',
  ariaLabelSlider = 'Before and after comparison',
}) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const outerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = modifiedImage;
  }, [modifiedImage]);

  const stage = getCoverStageSize(
    containerSize.width,
    containerSize.height,
    imageSize.width,
    imageSize.height
  );

  const handleMove = useCallback((clientX: number) => {
    if (stageRef.current) {
      const rect = stageRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(clientX - rect.left, rect.width));
      const percentage = (x / rect.width) * 100;
      setSliderPosition(percentage);
    }
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleTouchStart = () => setIsDragging(true);

  const handleMouseUp = () => setIsDragging(false);
  const handleTouchEnd = () => setIsDragging(false);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSliderPosition((prev) => Math.max(0, prev - step));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSliderPosition((prev) => Math.min(100, prev + step));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPosition(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPosition(100);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) handleMove(e.clientX);
  }, [isDragging, handleMove]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isDragging) handleMove(e.touches[0].clientX);
  }, [isDragging, handleMove]);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchend', handleTouchEnd);
    } else {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    }
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging]);

  return (
    <div
      ref={outerRef}
      className={`absolute inset-0 w-full h-full min-h-0 flex items-center justify-center bg-kv-chrome overflow-hidden select-none cursor-crosshair group ${className}`}
      onMouseMove={handleMouseMove}
      onTouchMove={handleTouchMove}
    >
      <div
        ref={stageRef}
        className="relative bg-kv-chrome shadow-2xl"
        style={{
          width: stage.width ? `${stage.width}px` : '100%',
          height: stage.height ? `${stage.height}px` : '100%',
        }}
      >
        <img
          src={modifiedImage}
          alt="After"
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          draggable={false}
        />

        <div
          className="absolute inset-0 bg-kv-chrome overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPosition}% 0 0)` }}
        >
          <img
            src={originalImage}
            alt="Before"
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        </div>

        <div
          role="slider"
          tabIndex={0}
          aria-label={ariaLabelSlider}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(sliderPosition)}
          aria-valuetext={`${Math.round(sliderPosition)}% before, ${Math.round(100 - sliderPosition)}% after`}
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize hover:shadow-[0_0_10px_rgba(255,255,255,0.5)] transition-shadow z-20"
          style={{ left: `${sliderPosition}%` }}
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
          onKeyDown={handleKeyDown}
        >
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg transform active:scale-110 transition-transform">
            <GripVertical className="text-gray-800 w-5 h-5" aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className="absolute top-4 left-4 bg-eb-900/70 text-eb-50 text-xs font-bold px-2 py-1 rounded backdrop-blur-sm pointer-events-none z-30">
        {labelBefore}
      </div>
      <div className="absolute top-4 right-4 bg-eb-900/70 text-eb-50 text-xs font-bold px-2 py-1 rounded backdrop-blur-sm pointer-events-none z-30">
        {labelAfter}
      </div>
    </div>
  );
};
