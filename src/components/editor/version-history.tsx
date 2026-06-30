import React from "react";
import { History } from "lucide-react";
import type { ContentStrings } from "../../content.ts";
import type { GeneratedImage } from "../../types.ts";

export interface VersionHistoryProps {
	content: ContentStrings;
	history: GeneratedImage[];
	currentImage: string | null;
	onSelectVersion: (dataUrl: string) => void;
	onClearHistory: () => void;
}

export const VersionHistory: React.FC<VersionHistoryProps> = ({
	content,
	history,
	currentImage,
	onSelectVersion,
	onClearHistory,
}) => (
	<div className="bg-white border-t-2 border-eb-900 p-4 md:p-6">
		<div className="flex items-center justify-between mb-4">
			<h3 className="text-xs font-black flex items-center gap-2">
				<History className="w-4 h-4" aria-hidden="true" /> {content.iterations}
			</h3>
			<button
				type="button"
				onClick={onClearHistory}
				className="text-xs font-black text-red-600 hover:text-red-700 transition-all"
			>
				{content.clearHistory}
			</button>
		</div>
		<div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
			{history.map((img, idx) => {
				const versionNumber = history.length - idx;
				const isCurrent = currentImage === img.dataUrl;
				return (
					<button
						key={img.id}
						type="button"
						onClick={() => onSelectVersion(img.dataUrl)}
						aria-current={isCurrent ? "true" : undefined}
						aria-label={`Version ${versionNumber}: ${img.prompt}`}
						className={`flex-shrink-0 relative w-40 border-2 transition-all text-left ${isCurrent ? "border-coral-500 ring-4 ring-coral-500/25 bg-eb-900" : "border-eb-900/10 grayscale hover:grayscale-0 hover:border-eb-900"}`}
					>
						<div className="aspect-[4/3] w-full bg-gray-100">
							<img
								src={img.dataUrl}
								className="w-full h-full object-cover"
								alt={`Version ${versionNumber}: ${img.prompt}`}
							/>
						</div>
						<div className="p-2 bg-white border-t-2 border-eb-900">
							<p
								className={`text-xs font-black truncate leading-none ${isCurrent ? "text-eb-50" : "text-eb-900"}`}
							>
								IDX_{versionNumber} • {img.prompt}
							</p>
						</div>
					</button>
				);
			})}
		</div>
	</div>
);
