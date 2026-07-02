import React from "react";
import {
	Download,
	Info,
	Library,
	MousePointer2,
	Paintbrush2,
	Save,
} from "lucide-react";
import type { ContentStrings } from "../../content.ts";
import type { Language } from "../../content.ts";
import { KIEZVISION_LOGO_URL } from "../../constants.ts";

export type AppView = "home" | "editor" | "library" | "image-gallery" | "about";

export interface AppHeaderProps {
	language: Language;
	content: ContentStrings;
	view: AppView;
	editMode: "comparison" | "mask";
	originalImage: string | null;
	currentImage: string | null;
	onGoHome: () => void;
	onGoAbout: () => void;
	onGoLibrary: () => void;
	onSetEditModeComparison: () => void;
	onSetEditModeMask: () => void;
	onSave: () => void;
	onDownload: () => void;
	onSetLanguage: (language: Language) => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
	language,
	content,
	view,
	editMode,
	originalImage,
	currentImage,
	onGoHome,
	onGoAbout,
	onGoLibrary,
	onSetEditModeComparison,
	onSetEditModeMask,
	onSave,
	onDownload,
	onSetLanguage,
}) => (
	<header className="border-b-2 border-eb-900 bg-tsb sticky top-0 z-50 max-w-full overflow-x-hidden">
		<nav
			aria-label={language === "en" ? "Main navigation" : "Hauptnavigation"}
			className="w-full max-w-full min-w-0 px-3 sm:px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between gap-2 sm:gap-3 lg:gap-4"
		>
			<div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0 shrink">
				<button
					onClick={onGoHome}
					aria-label={language === "en" ? "Go to homepage" : "Zur Startseite"}
					className="bg-eb-50 p-0 h-10 w-10 flex items-center justify-center border-2 border-eb-900 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all overflow-hidden"
				>
					<img
						src={KIEZVISION_LOGO_URL}
						className="w-full h-full object-cover"
						alt=""
						aria-hidden="true"
					/>
				</button>
				<div>
					<h1 className="text-lg sm:text-xl lg:text-2xl font-black tracking-tighter leading-none mb-1 text-eb-50 truncate">
						KiezVision
					</h1>
					<div className="hidden lg:flex items-center gap-3">
						<span className="text-xs font-black bg-coral-100 text-eb-900 px-2 py-0.5 whitespace-nowrap">
							{content.tagline}
						</span>
					</div>
				</div>
			</div>

			{view === "editor" && originalImage && (
				<div
					role="group"
					aria-label={language === "en" ? "Edit mode" : "Bearbeitungsmodus"}
					className="flex items-center gap-1 sm:gap-2 bg-eb-50/15 p-1 border-2 border-eb-50/40 h-10 lg:h-12 shrink-0"
				>
					<button
						onClick={onSetEditModeComparison}
						aria-pressed={editMode === "comparison"}
						className={`flex items-center gap-1.5 px-2.5 sm:px-3 lg:px-6 h-full text-xs font-black transition-all ${editMode === "comparison" ? "bg-coral-100 text-eb-900" : "text-eb-50 hover:bg-white/10"}`}
					>
						<MousePointer2 className="w-4 h-4 shrink-0" aria-hidden="true" />
						<span className="hidden lg:inline">{content.compare}</span>
						<span className="sr-only lg:hidden">{content.compare}</span>
					</button>
					<button
						onClick={onSetEditModeMask}
						aria-pressed={editMode === "mask"}
						className={`flex items-center gap-1.5 px-2.5 sm:px-3 lg:px-6 h-full text-xs font-black transition-all ${editMode === "mask" ? "bg-coral-100 text-eb-900" : "text-eb-50 hover:bg-white/10"}`}
					>
						<Paintbrush2 className="w-4 h-4 shrink-0" aria-hidden="true" />
						<span className="hidden lg:inline">{content.areaEdit}</span>
						<span className="sr-only lg:hidden">{content.areaEdit}</span>
					</button>
				</div>
			)}

			<div className="flex items-center gap-2 lg:gap-4 h-10 shrink-0">
				<button
					onClick={onGoAbout}
					aria-current={view === "about" ? "page" : undefined}
					className={`flex items-center gap-1.5 px-2.5 sm:px-3 lg:px-6 h-full border-2 border-eb-900 text-xs font-black transition-all ${view === "about" ? "bg-eb-900 text-eb-50" : "bg-eb-50 text-eb-900 hover:bg-coral-100 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)]"}`}
				>
					<Info className="w-4 h-4 shrink-0" aria-hidden="true" />
					<span className="hidden lg:inline">{content.about}</span>
					<span className="sr-only lg:hidden">{content.about}</span>
				</button>
				<button
					onClick={onGoLibrary}
					aria-current={view === "library" ? "page" : undefined}
					className={`flex items-center gap-1.5 px-2.5 sm:px-3 lg:px-6 h-full border-2 border-eb-900 text-xs font-black transition-all ${view === "library" ? "bg-eb-900 text-eb-50" : "bg-eb-50 text-eb-900 hover:bg-coral-100 shadow-[4px_4px_0px_0px_rgba(32,32,27,1)]"}`}
				>
					<Library className="w-4 h-4 shrink-0" aria-hidden="true" />
					<span className="hidden lg:inline">{content.library}</span>
					<span className="sr-only lg:hidden">{content.library}</span>
				</button>

				{view === "editor" && currentImage && (
					<div className="flex items-center gap-1.5 sm:gap-2 h-full">
						<button
							onClick={onSave}
							aria-label={
								language === "en" ? "Save to library" : "In Galerie speichern"
							}
							className="bg-eb-900 text-eb-50 px-2.5 sm:px-3 lg:px-6 h-full border-2 border-eb-900 text-xs font-black transition-all shadow-[4px_4px_0px_0px_rgba(254,68,65,0.35)] hover:shadow-none hover:bg-coral-500 flex items-center gap-1.5"
						>
							<Save className="w-4 h-4 shrink-0" aria-hidden="true" />
							<span className="hidden lg:inline">{content.save}</span>
						</button>
						<button
							onClick={onDownload}
							aria-label={
								language === "en" ? "Download image" : "Bild herunterladen"
							}
							className="bg-eb-900 text-eb-50 px-2.5 sm:px-3 lg:px-4 h-full border-2 border-eb-900 text-xs font-black transition-all shadow-[4px_4px_0px_0px_rgba(254,68,65,0.35)] hover:shadow-none hover:bg-coral-500 flex items-center justify-center"
						>
							<Download className="w-4 h-4" aria-hidden="true" />
						</button>
					</div>
				)}

				<div
					role="group"
					aria-label={language === "en" ? "Language" : "Sprache"}
					className="flex items-center border-2 border-eb-900 bg-eb-50 overflow-hidden shadow-[4px_4px_0px_0px_rgba(32,32,27,1)] h-full"
				>
					<button
						onClick={() => onSetLanguage("en")}
						aria-pressed={language === "en"}
						aria-label="English"
						className={`px-2 sm:px-3 h-full text-xs font-black transition-all ${language === "en" ? "bg-eb-900 text-eb-50" : "text-eb-900 hover:bg-coral-100"}`}
					>
						EN
					</button>
					<button
						onClick={() => onSetLanguage("de")}
						aria-pressed={language === "de"}
						aria-label="Deutsch"
						className={`px-2 sm:px-3 h-full text-xs font-black transition-all border-l-2 border-eb-900 ${language === "de" ? "bg-eb-900 text-eb-50" : "text-eb-900 hover:bg-coral-100"}`}
					>
						DE
					</button>
				</div>
			</div>
		</nav>
	</header>
);
