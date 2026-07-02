import React from "react";
import type { ContentStrings } from "../../content.ts";

export interface EditorSourceOverlayProps {
	content: ContentStrings;
	imageSource: string;
	locationLabel: string;
	mapillaryLink?: string;
	onChangeImagery: () => void;
}

export const EditorSourceOverlay: React.FC<EditorSourceOverlayProps> = ({
	content,
	imageSource,
	locationLabel,
	mapillaryLink,
	onChangeImagery,
}) => (
	<div className="absolute bottom-10 left-10 z-30 flex flex-col gap-2 pointer-events-none max-w-[min(100%,14rem)]">
		<div className="flex flex-col gap-0 border-2 border-eb-900 bg-white shadow-[6px_6px_0px_0px_rgba(32,32,27,1)] pointer-events-none">
			<div className="bg-tsb text-eb-50 px-3 py-1 text-xs font-black">
				{content.sourceLabel}:{" "}
				{imageSource.includes("Mapillary")
					? content.sourcePhotographic
					: content.sourceSynthetic}
			</div>
			<div className="px-4 py-2">
				<span className="text-xs font-black tracking-tighter">
					{locationLabel}
				</span>
			</div>
		</div>
		<div className="flex flex-col gap-1.5 pointer-events-auto w-fit">
			<button
				type="button"
				onClick={onChangeImagery}
				className="flex items-center gap-2 bg-coral-100 border-2 border-eb-900 px-4 py-2 text-xs font-black shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:shadow-none transition-all text-left"
			>
				{content.externalImageryView}
			</button>
			{mapillaryLink && (
				<a
					href={mapillaryLink}
					target="_blank"
					rel="noreferrer"
					className="text-[10px] font-black underline"
				>
					{content.imageryOpenMapillary}
					<span className="sr-only"> (opens in new window)</span>
				</a>
			)}
		</div>
	</div>
);
