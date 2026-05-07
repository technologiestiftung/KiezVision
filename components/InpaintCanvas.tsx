import React, { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { RotateCcw, Palette, MousePointer2, Paintbrush2 } from 'lucide-react';

interface InpaintCanvasProps {
  image: string;
  onOverlayChange: (data: { mask?: string } | null) => void;
  brushSize: number;
}

const COLORS = [
  '#ffffff',
];

export const InpaintCanvas = forwardRef<{ clear: () => void }, InpaintCanvasProps>(({ 
  image, 
  onOverlayChange, 
  brushSize,
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imageCanvasRef = useRef<HTMLCanvasElement>(null);
  const drawingCanvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const [isEraser, setIsEraser] = useState(false);
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

  useImperativeHandle(ref, () => ({
    clear: clearCanvas
  }));

  const lastImageRef = useRef<string>('');

  const initCanvases = useCallback(() => {
    // Only initialize if the image has actually changed
    if (image === lastImageRef.current) return;
    lastImageRef.current = image;

    // Clear any existing mask when the background image changes
    onOverlayChange(null);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = image;
    img.onload = () => {
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
    };
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
    const canvas = drawingCanvasRef.current;
    if (!canvas) return;

    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = canvas.width;
    maskCanvas.height = canvas.height;
    const mctx = maskCanvas.getContext('2d');
    if (mctx) {
      mctx.fillStyle = 'black';
      mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
      
      // Use color filtering to ensure the mask is purely black and white
      mctx.drawImage(canvas, 0, 0);
      
      const imageData = mctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      const data = imageData.data;
      for (let i = 0; i < data.length; i += 4) {
        // If any RGB component is > 0, make it white (thresholding)
        const brightness = (data[i] + data[i+1] + data[i+2]) / 3;
        if (brightness > 10) {
          data[i] = 255;
          data[i+1] = 255;
          data[i+2] = 255;
        } else {
          data[i] = 0;
          data[i+1] = 0;
          data[i+2] = 0;
        }
        data[i+3] = 255; // Fully opaque
      }
      mctx.putImageData(imageData, 0, 0);
      
      onOverlayChange({ 
        mask: maskCanvas.toDataURL('image/png')
      });
    }
  };

  const stopDrawing = () => {
    setMousePos(null);
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    updateOverlays();
  };

  const startDrawing = (e: any) => {
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
      return { width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' };
    }

    const scale = Math.min(cw / iw, ch / ih);
    const width = iw * scale;
    const height = ih * scale;
    return {
      width: `${width}px`,
      height: `${height}px`,
      maxWidth: '100%',
      maxHeight: '100%',
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
        
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-tsb border-2 border-eb-50 px-2 py-2 shadow-[8px_8px_0px_0px_rgba(30,55,145,0.45)] z-20">
          <div className="flex items-center gap-1 pr-2 border-r border-eb-50/25">
            <button 
              onClick={() => setIsEraser(false)} 
              className={`h-11 w-11 flex items-center justify-center transition-all ${!isEraser ? 'bg-coral-100 text-eb-900 shadow-inner shadow-eb-900/20 font-black' : 'text-eb-50 hover:bg-white/10'}`}
              title="Brush"
            >
              <Paintbrush2 className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsEraser(true)} 
              className={`h-11 w-11 flex items-center justify-center transition-all ${isEraser ? 'bg-coral-500 text-eb-50 shadow-inner shadow-eb-900/20 font-black' : 'text-eb-50 hover:bg-white/10'}`}
              title="Eraser"
            >
              <div className="w-5 h-5 flex items-center justify-center font-black text-[12px]">E</div>
            </button>
          </div>

          <button onClick={clearCanvas} className="h-11 w-11 flex items-center justify-center text-eb-50 hover:bg-white/10 transition-colors">
            <RotateCcw className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-[10px] font-black text-eb-50 tracking-widest px-4 border-l border-eb-50/25">
            Area Edit Tool
          </div>
        </div>

        <div className="absolute top-10 left-10 z-20 flex flex-col gap-2">
          <div className="bg-coral-100 text-eb-900 px-4 py-2 border-2 border-eb-900 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] text-[11px] font-black">
            Selection Mode
          </div>
          <div className="bg-white border-2 border-eb-900 p-4 text-[10px] font-bold text-eb-900 max-w-[240px] shadow-[6px_6px_0px_0px_rgba(32,32,27,0.12)] tracking-tight">
            <span className="text-coral-500 font-black block mb-2 underline decoration-2">Pro Tip: Placement</span>
            Paint the <span className="underline">exact spot</span> where the object's base touches the ground. The AI uses the <span className="bg-eb-900 text-eb-50 px-1">bottom</span> of your paint as the anchor.
          </div>
        </div>
      </div>
    </div>
  );
});