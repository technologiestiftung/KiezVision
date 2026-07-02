import React, { useCallback } from "react";
import { Download, Trash2, Wand2 } from "lucide-react";
import type { ContentStrings } from "../../content.ts";
import type { Language } from "../../content.ts";
import type { LibraryEntry } from "../../types.ts";

interface LibraryEntryCardProps {
	item: LibraryEntry;
	thumbUrl: string | null;
	language: Language;
	content: ContentStrings;
	onOpenInEditor: (item: LibraryEntry) => void | Promise<void>;
	onDownload: (item: LibraryEntry) => void | Promise<void>;
	onDelete: (id: string) => void | Promise<void>;
}

export const LibraryEntryCard: React.FC<LibraryEntryCardProps> = ({
	item,
	thumbUrl,
	language,
	content,
	onOpenInEditor,
	onDownload,
	onDelete,
}) => {
	const open = useCallback(() => {
		void onOpenInEditor(item);
	}, [item, onOpenInEditor]);

	return (
		<article className="group relative bg-white border-2 border-eb-900 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)] hover:shadow-none transition-all">
			<div className="aspect-[4/3] w-full border-b-2 border-eb-900 overflow-hidden bg-gray-100">
				{thumbUrl ? (
					<img
						src={thumbUrl}
						className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
						alt={item.prompt}
					/>
				) : (
					<div
						className="w-full h-full bg-gray-100 animate-pulse"
						aria-hidden="true"
					/>
				)}
			</div>
			<div className="p-8">
				<p className="text-xs font-black mb-6 border-l-4 border-eb-900 pl-4 leading-relaxed">
					{item.prompt}
				</p>
				<div className="flex items-center gap-4">
					<button
						type="button"
						onClick={open}
						className="flex-1 bg-eb-900 text-eb-50 h-14 text-xs font-black hover:bg-coral-100 hover:text-eb-900 transition-all flex items-center justify-center gap-2"
					>
						<Wand2 className="w-4 h-4" aria-hidden="true" />{" "}
						{content.openInEditor}
					</button>
					<button
						type="button"
						onClick={() => void onDownload(item)}
						className="h-14 w-14 flex items-center justify-center bg-eb-900 text-eb-50 border-2 border-eb-900 hover:bg-coral-100 hover:text-eb-900 transition-all"
						aria-label={
							language === "en" ? "Download image" : "Bild herunterladen"
						}
					>
						<Download className="w-5 h-5" aria-hidden="true" />
					</button>
					<button
						type="button"
						onClick={() => void onDelete(item.id)}
						className="h-14 w-14 flex items-center justify-center bg-red-600 text-eb-50 border-2 border-eb-900 hover:bg-eb-900 transition-all"
						aria-label={language === "en" ? "Delete vision" : "Vision löschen"}
					>
						<Trash2 className="w-5 h-5" aria-hidden="true" />
					</button>
				</div>
			</div>
		</article>
	);
};
