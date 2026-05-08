import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
interface InpaintCanvasProps {
  image: string;
  onOverlayChange: (data: { mask?: string } | null) => void;
  brushSize: number;
  isEraser: boolean;
}

const COLORS = [
  '#ffffff',
];

export const InpaintCanvas = forwardRef<
  { clear: () => void; getMaskDataUrl: () => string | null },
  InpaintCanvasProps
>(({ image, onOverlayChange, brushSize, isEraser }, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  /** Prevents paint until base image has sized canvases (avoids onload clearing strokes mid-brush). */
  const baseImageReadyRef = useRef(false);
  /** Discards stale Image() decode callbacks after remount or image change. */
  const imageLoadGenRef = useRef(0);
  const selectedColor = '#ffffff';
  const [mousePos, setMousePos] = useState<{ x: number, y: number } | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [imageSize, setImageSize] = useState({ width: 1, height: 1 });

  const clearCanvas = () => {
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onOverlayChange(null);
    }
  };

  const buildMaskDataUrlFromDrawing = (): string | null => {
    const canvas = drawingCanvasRef.current;
    if (!canvas || !canvas.width || !canvas.height) return null;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const mctx = maskCanvas.getContext('2d');
    if (!mctx) return null;

    mctx.fillStyle = 'black';
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    mctx.drawImage(canvas, 0, 0);

    const imageData = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (brightness > 10) {
        data[i] = 255;
        data[i + 1] = 255;
        data[i + 2] = 255;
      } else {
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
      data[i + 3] = 255;
    }
    mctx.putImageData(imageData, 0, 0);
    return maskCanvas.toDataURL('image/png');
  };

  useImperativeHandle(ref, () => ({
    clear: clearCanvas,
    getMaskDataUrl: () => buildMaskDataUrlFromDrawing(),
  }));

  const lastImageRef = useRef<string>('');

  const initCanvases = useCallback(() => {
    // Same URL but decode never finished — must retry, not bail
    if (image === lastImageRef.current && baseImageReadyRef.current) return;

    lastImageRef.current = image;
    baseImageReadyRef.current = false;

    const loadId = ++imageLoadGenRef.current;

    // Clear any existing mask when the background image changes
    onOverlayChange(null);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (loadId !== imageLoadGenRef.current) return;
      const imgCanvas = imageCanvasRef.current;
      const drwCanvas = drawingCanvasRef.current;
      if (!imgCanvas || !drwCanvas) return;

      setImageSize({ width: img.width, height: img.height });

      imgCanvas.width = img.width;
      imgCanvas.height = img.height;
      drwCanvas.width = img.width;
      drwCanvas.height = img.height;

      const ctx = imgCanvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);

      const dctx = drwCanvas.getContext('2d');
      dctx?.clearRect(0, 0, drwCanvas.width, drwCanvas.height);
      baseImageReadyRef.current = true;
    };
    img.onerror = () => {
      if (loadId !== imageLoadGenRef.current) return;
      baseImageReadyRef.current = false;
    };
    img.src = image;
  }, [image, onOverlayChange]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      setContainerSize({
        width: el.clientWidth,
        height: el.clientHeight
      });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    initCanvases();
  }, [initCanvases]);

  const getCoordinates = (e: any) => {
    const canvas = drawingCanvasRef.current;
    if (!canvas) return { x: 0, y: 0, scale: 1 };
    
    const rect = canvas.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return { 
      x: (clientX - rect.left) * scaleX, 
      y: (clientY - rect.top) * scaleY,
      clientX,
      clientY,
      scale: 1 / scaleX // Using X scale for brush normalization
    };
  };

  const draw = (e: any) => {
    if (!baseImageReadyRef.current) return;
    if (e.type.startsWith('touch')) {
      if (e.cancelable) e.preventDefault();
    }

    const { x, y, clientX, clientY, scale } = getCoordinates(e);
    setMousePos({ x: clientX, y: clientY });

    if (!isDrawingRef.current) return;
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = (brushSize * 2) / scale; 
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const updateOverlays = () => {
    if (!baseImageReadyRef.current) return;
    const dataUrl = buildMaskDataUrlFromDrawing();
    if (dataUrl) onOverlayChange({ mask: dataUrl });
  };

  const stopDrawing = () => {
    setMousePos(null);
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    updateOverlays();
  };

  const startDrawing = (e: any) => {
    if (!baseImageReadyRef.current) return;
    if (e.type.startsWith('touch')) {
      if (e.cancelable) e.preventDefault();
    }
    const { x, y, clientX, clientY, scale } = getCoordinates(e);
    setMousePos({ x: clientX, y: clientY });

    isDrawingRef.current = true;
    const canvas = drawingCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (ctx) {
      ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over';
      ctx.strokeStyle = selectedColor;
      ctx.lineWidth = (brushSize * 2) / scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    
    // Call updateOverlays even on start in case it's just a dot
    updateOverlays();
  };

  const getVisualBrushSize = () => {
    return brushSize * 2;
  };

  const getStageSize = (): React.CSSProperties => {
    const { width: cw, height: ch } = containerSize;
    const { width: iw, height: ih } = imageSize;
    if (!cw || !ch || !iw || !ih) {
      return { width: '100%', height: '100%' };
    }

    // Cover container: fills frame edge-to-edge; excess cropped by overflow-hidden parent
    const scale = Math.max(cw / iw, ch / ih);
    return {
      width: `${iw * scale}px`,
      height: `${ih * scale}px`,
    };
  };

  return (
    <div 
      ref={containerRef} 
      className="absolute inset-0 w-full h-full min-h-0 bg-kv-chrome flex items-center justify-center overflow-hidden cursor-none"
      onMouseMove={(e) => {
        const { clientX, clientY } = e;
        setMousePos({ x: clientX, y: clientY });
        if (isDrawingRef.current) draw(e);
      }}
      onMouseEnter={(e) => {
        const { clientX, clientY } = e;
        setMousePos({ x: clientX, y: clientY });
      }}
      onMouseUp={stopDrawing}
      onMouseLeave={() => {
        setMousePos(null);
        stopDrawing();
      }}
      onMouseDown={startDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
    >
      <div className="relative shadow-2xl" style={getStageSize()}>
        <canvas ref={imageCanvasRef} className="absolute inset-0 w-full h-full" />
        <canvas 
          ref={drawingCanvasRef} 
          className="absolute inset-0 w-full h-full z-10 opacity-75 pointer-events-none"
        />

        {/* Brush Preview Cursor */}
        {mousePos && (
          <div 
            className={`fixed pointer-events-none z-50 border border-white/50 rounded-full ${isEraser ? 'mix-blend-normal bg-red-500/20 border-red-500' : 'mix-blend-difference'}`}
            style={{
              left: mousePos.x,
              top: mousePos.y,
              width: `${getVisualBrushSize()}px`,
              height: `${getVisualBrushSize()}px`,
              transform: 'translate(-50%, -50%)',
              backgroundColor: isEraser ? undefined : 'rgba(59, 130, 246, 0.4)',
              boxShadow: isEraser ? '0 0 10px rgba(239, 68, 68, 0.3)' : '0 0 0 1px rgba(0,0,0,0.2)'
            }}
          >
            {isEraser && <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-red-500">ERASER</div>}
          </div>
        )}
      </div>
    </div>
  );
});