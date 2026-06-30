import React, { type RefObject } from "react";
import { Wand2 } from "lucide-react";
import type { ContentStrings } from "../../content.ts";
import type { Language } from "../../content.ts";
import type { EditMode, InpaintCanvasHandle } from "../../hooks/use-editor.ts";
import type { GeneratedImage, ProcessingState } from "../../types.ts";
import { BeforeAfterSlider } from "./before-after-slider.tsx";
import { EditorSourceOverlay } from "./editor-source-overlay.tsx";
import { InpaintCanvas } from "./inpaint-canvas.tsx";
import { MaskSettingsPanel } from "./mask-settings-panel.tsx";
import { QuickActions } from "./quick-actions/quick-actions.tsx";
import { TransformationPanel } from "./transformation-panel.tsx";
import { VersionHistory } from "./version-history.tsx";
import { ProcessingOverlay } from "../primitives/overlays/processing-overlay.tsx";

export interface EditorViewProps {
	language: Language;
	content: ContentStrings;
	originalImage: string;
	currentImage: string | null;
	history: GeneratedImage[];
	editMode: EditMode;
	processing: ProcessingState;
	brushSize: number;
	isAreaEditEraser: boolean;
	maskBase64: string | null;
	inpaintMountKey: number;
	imageSource: string | null;
	locationLabel: string;
	mapillaryMetadata: { link: string; capturedAt?: string } | null;
	canvasRef: RefObject<InpaintCanvasHandle | null>;
	onOverlayChange: (data: { mask?: string } | null) => void;
	onTransform: (prompt: string) => void | Promise<void>;
	onSelectVersion: (dataUrl: string) => void;
	onBrushSizeChange: (size: number) => void;
	onSetBrush: () => void;
	onSetEraser: () => void;
	onClearHistory: () => void;
	onReopenImageryPicker: () => void;
}

export const EditorView: React.FC<EditorViewProps> = ({
	language,
	content,
	originalImage,
	currentImage,
	history,
	editMode,
	processing,
	brushSize,
	isAreaEditEraser,
	maskBase64,
	inpaintMountKey,
	imageSource,
	locationLabel,
	mapillaryMetadata,
	canvasRef,
	onOverlayChange,
	onTransform,
	onSelectVersion,
	onBrushSizeChange,
	onSetBrush,
	onSetEraser,
	onClearHistory,
	onReopenImageryPicker,
}) => (
	<div className="flex flex-col md:grid md:grid-cols-12 min-h-[calc(100vh-80px)] md:h-[calc(100vh-80px)] md:max-h-[calc(100vh-80px)]">
		<div className="order-1 md:order-none col-span-12 md:col-span-8 flex flex-col flex-1 min-h-0 w-full md:h-full md:max-h-full bg-white border-r-0 md:border-r-2 border-eb-900">
			<div className="relative flex-1 min-h-[min(42vh,320px)] md:min-h-0 bg-kv-chrome overflow-hidden">
				{processing.isProcessing && (
					<ProcessingOverlay
						title=""
						statusMessage={processing.statusMessage}
						variant="inline"
					/>
				)}

				<div className="absolute inset-0 min-h-0 bg-kv-chrome">
					{editMode !== "comparison" ? (
						<InpaintCanvas
							key={inpaintMountKey}
							ref={canvasRef}
							image={currentImage || originalImage}
							onOverlayChange={onOverlayChange}
							brushSize={brushSize}
							isEraser={isAreaEditEraser}
							ariaLabel={content.drawingCanvasLabel}
							ariaRoleDescription={content.drawingCanvasRoleDescription}
							imageDescription={locationLabel}
						/>
					) : (
						<BeforeAfterSlider
							originalImage={originalImage}
							modifiedImage={currentImage || originalImage}
							labelBefore={content.before}
							labelAfter={content.after}
							ariaLabelSlider={content.beforeAfterComparison}
						/>
					)}
				</div>

				{imageSource && !processing.isProcessing && (
					<EditorSourceOverlay
						content={content}
						imageSource={imageSource}
						locationLabel={locationLabel}
						mapillaryLink={mapillaryMetadata?.link}
						onChangeImagery={onReopenImageryPicker}
					/>
				)}
			</div>

			<VersionHistory
				content={content}
				history={history}
				currentImage={currentImage}
				onSelectVersion={onSelectVersion}
				onClearHistory={onClearHistory}
			/>
		</div>

		<div className="order-2 md:order-none col-span-12 md:col-span-4 w-full shrink-0 md:h-full md:min-h-0 bg-coral-500 flex flex-col p-4 sm:p-5 md:p-5 lg:p-8 overflow-y-auto custom-scrollbar border-t-2 md:border-t-0 border-eb-900">
			<div className="mb-6 md:mb-8 lg:mb-10 bg-tsb text-eb-50 p-3 md:p-4 shadow-[8px_8px_0px_0px_rgba(30,55,145,0.35)]">
				<h2 className="text-lg md:text-xl lg:text-2xl font-black tracking-tighter flex items-center gap-2 md:gap-3">
					<Wand2 className="w-5 h-5 md:w-6 md:h-6 shrink-0" /> {content.toolkit}
				</h2>
			</div>

			<div className="space-y-6 md:space-y-8 lg:space-y-10">
				{editMode === "mask" && (
					<MaskSettingsPanel
						content={content}
						brushSize={brushSize}
						isEraser={isAreaEditEraser}
						canvasRef={canvasRef}
						onBrushSizeChange={onBrushSizeChange}
						onSetBrush={onSetBrush}
						onSetEraser={onSetEraser}
					/>
				)}

				<div className="bg-white border-2 border-eb-900 p-4 md:p-6 shadow-[8px_8px_0px_0px_rgba(32,32,27,1)]">
					<h3 className="text-xs font-black border-b-2 border-eb-900 pb-2 mb-0">
						{content.presets}
					</h3>
					<QuickActions
						onAction={onTransform}
						disabled={processing.isProcessing}
						language={language}
						presetsBlocked={editMode === "mask" && !maskBase64}
					/>
				</div>

				<div className="bg-white border-2 border-eb-900 p-4 md:p-6 shadow-[8px_8px_0px_0px_rgba(32,32,27,1)]">
					<TransformationPanel
						onTransform={onTransform}
						isProcessing={processing.isProcessing}
						isMaskMode={editMode === "mask"}
						placeholder={
							editMode === "mask"
								? content.placeholderMask
								: content.placeholderEditor
						}
						language={language}
					/>
				</div>
			</div>

			<div className="mt-12 text-xs font-black text-eb-900/70 border-t border-eb-900/20 pt-4 text-center">
				{content.tagline}
			</div>
		</div>
	</div>
);
