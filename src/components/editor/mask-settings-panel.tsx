import React, { type RefObject } from "react";
import { Eraser, Paintbrush2, RotateCcw } from "lucide-react";
import type { ContentStrings } from "../../content.ts";
import type { InpaintCanvasHandle } from "../../hooks/use-editor.ts";

export interface MaskSettingsPanelProps {
	content: ContentStrings;
	brushSize: number;
	isEraser: boolean;
	canvasRef: RefObject<InpaintCanvasHandle | null>;
	onBrushSizeChange: (size: number) => void;
	onSetBrush: () => void;
	onSetEraser: () => void;
}

export const MaskSettingsPanel: React.FC<MaskSettingsPanelProps> = ({
	content,
	brushSize,
	isEraser,
	canvasRef,
	onBrushSizeChange,
	onSetBrush,
	onSetEraser,
}) => (
	<div className="bg-white border-2 border-eb-900 p-4 md:p-6 shadow-[8px_8px_0px_0px_rgba(32,32,27,1)]">
		<h3 className="text-xs font-black border-b-2 border-eb-900 pb-1 mb-6">
			{content.maskSettings}
		</h3>
		<div className="flex items-center justify-between mb-6">
			<h4
				id="brush-size-label"
				className="text-xs font-black border-b-2 border-eb-900 pb-1"
			>
				{content.size}
			</h4>
			<span className="font-mono text-xs bg-eb-900 text-eb-50 px-2 py-0.5">
				{brushSize}PX
			</span>
		</div>
		<label htmlFor="brush-size" className="sr-only">
			{content.size}
		</label>
		<input
			id="brush-size"
			type="range"
			min="10"
			max="150"
			value={brushSize}
			onChange={(e) => onBrushSizeChange(parseInt(e.target.value, 10))}
			aria-labelledby="brush-size-label"
			aria-valuemin={10}
			aria-valuemax={150}
			aria-valuenow={brushSize}
			aria-valuetext={`${brushSize} pixels`}
			className="w-full h-6 accent-eb-900 appearance-none bg-gray-100 border border-eb-900 cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-eb-900 [&::-webkit-slider-thumb]:rounded-none mb-6"
		/>
		<div className="flex items-center gap-2 mb-4">
			<button
				type="button"
				onClick={onSetBrush}
				title={content.brush}
				aria-pressed={!isEraser}
				className={`flex-1 flex items-center justify-center gap-2 py-3 border-2 border-eb-900 text-xs font-black transition-all ${
					!isEraser
						? "bg-coral-100 text-eb-900 shadow-[3px_3px_0_0_rgba(32,32,27,1)]"
						: "bg-white text-eb-900 hover:bg-gray-50"
				}`}
			>
				<Paintbrush2 className="w-4 h-4" aria-hidden /> {content.brush}
			</button>
			<button
				type="button"
				onClick={onSetEraser}
				title={content.eraser}
				aria-pressed={isEraser}
				className={`flex-1 flex items-center justify-center gap-2 py-3 border-2 border-eb-900 text-xs font-black transition-all ${
					isEraser
						? "bg-coral-500 text-eb-50 shadow-[3px_3px_0_0_rgba(32,32,27,1)]"
						: "bg-white text-eb-900 hover:bg-gray-50"
				}`}
			>
				<Eraser className="w-4 h-4" aria-hidden /> {content.eraser}
			</button>
		</div>
		<button
			type="button"
			onClick={() => canvasRef.current?.clear()}
			className="w-full flex items-center justify-center gap-2 py-3 border-2 border-eb-900 bg-tsb text-eb-50 text-xs font-black shadow-[4px_4px_0_0_rgba(30,55,145,0.35)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all mb-4"
		>
			<RotateCcw className="w-4 h-4" aria-hidden /> {content.clearMask}
		</button>
		<p className="text-xs font-bold text-eb-900 tracking-tight leading-snug border-t border-eb-900/15 pt-4">
			<span className="text-coral-500 font-black block mb-1">
				{content.areaEditTipTitle}
			</span>
			{content.areaEditTipBody}
		</p>
	</div>
);
