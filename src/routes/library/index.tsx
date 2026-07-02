import { useNavigate } from "react-router-dom";
import { AlertCircle, FolderOpen, Library, Wand2 } from "lucide-react";
import type { ContentStrings } from "../../content.ts";
import { BackToHomeButton } from "../../components/primitives/navigation/back-to-home-button.tsx";
import { useAppContext } from "../../context/app-context.tsx";
import type { LibraryFolderStatus } from "../../services/libraryStorage.ts";
import { LibraryEntryCard } from "./library-entry-card.tsx";

function folderStatusBadgeClass(status: LibraryFolderStatus): string {
	if (status === "connected") return "bg-coral-100 text-eb-900";
	if (status === "needs-permission") return "bg-yellow-100 text-eb-900";
	return "bg-white text-eb-900";
}

function folderStatusLabel(
	status: LibraryFolderStatus,
	content: ContentStrings,
): string {
	if (status === "connected") return content.libraryFolderConnected;
	if (status === "needs-permission")
		return content.libraryFolderNeedsPermission;
	return content.libraryFolderDisconnected;
}

export default function LibraryPage() {
	const navigate = useNavigate();
	const {
		language,
		content,
		library,
		handleOpenLibraryEntry,
		handleDownloadLibraryEntry,
	} = useAppContext();

	const {
		folderStatus,
		userSavedCount,
		libraryByDate,
		thumbCache,
		formatDateHeader,
		handleChooseLibraryFolder,
		handleReconnectLibraryFolder,
		removeFromLibrary,
	} = library;

	return (
		<div className="max-w-screen-2xl mx-auto px-6 sm:px-10 lg:px-16 py-12">
			<div className="flex flex-wrap items-end justify-between gap-6 mb-16 border-b-4 border-eb-900 pb-8">
				<div>
					<div className="mb-4">
						<BackToHomeButton navigate={navigate} label={content.backToHome} />
					</div>
					<h2 className="text-6xl font-black tracking-tighter leading-none">
						{content.imageLibrary}
					</h2>
				</div>
				{folderStatus === "unsupported" ? (
					<div className="flex items-center gap-2 px-4 h-10 border-2 border-eb-900 bg-white text-eb-900 text-xs font-black max-w-md">
						<AlertCircle className="w-4 h-4" />{" "}
						{content.browserUnsupportedFolder}
					</div>
				) : (
					<div className="flex items-center gap-3">
						<div
							className={`flex items-center gap-2 px-4 h-10 border-2 border-eb-900 text-xs font-black ${folderStatusBadgeClass(folderStatus)}`}
						>
							{folderStatus === "needs-permission" ? (
								<AlertCircle className="w-4 h-4" />
							) : (
								<FolderOpen className="w-4 h-4" />
							)}
							{folderStatusLabel(folderStatus, content)}
						</div>
						{folderStatus === "needs-permission" ? (
							<button
								onClick={() => void handleReconnectLibraryFolder()}
								className="flex items-center gap-2 px-4 h-10 border-2 border-eb-900 bg-eb-900 text-eb-50 text-xs font-black shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
							>
								<FolderOpen className="w-4 h-4" />
								{content.reconnectLibraryFolder}
							</button>
						) : (
							<button
								onClick={() => void handleChooseLibraryFolder()}
								className="flex items-center gap-2 px-4 h-10 border-2 border-eb-900 bg-eb-900 text-eb-50 text-xs font-black shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
							>
								<FolderOpen className="w-4 h-4" />
								{folderStatus === "connected"
									? content.changeLibraryFolder
									: content.chooseLibraryFolder}
							</button>
						)}
					</div>
				)}
			</div>

			{folderStatus === "needs-permission" && (
				<div className="mb-10 bg-yellow-100 border-4 border-eb-900 p-6 shadow-[8px_8px_0px_0px_rgba(255,207,214,1)] flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
					<div className="flex items-start gap-4">
						<div className="flex-shrink-0 w-10 h-10 flex items-center justify-center border-2 border-eb-900 bg-coral-100">
							<AlertCircle className="w-5 h-5 text-eb-900" />
						</div>
						<div>
							<h3 className="text-lg font-black tracking-tighter mb-1">
								{content.reconnectBannerTitle}
							</h3>
							<p className="text-xs font-bold text-eb-900/70 leading-relaxed">
								{content.reconnectBannerSubtitle}
							</p>
						</div>
					</div>
					<button
						onClick={() => void handleReconnectLibraryFolder()}
						className="flex-shrink-0 inline-flex items-center gap-2 bg-eb-900 text-eb-50 px-6 h-12 border-2 border-eb-900 text-xs font-black shadow-[4px_4px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
					>
						<FolderOpen className="w-4 h-4" /> {content.reconnectLibraryFolder}
					</button>
				</div>
			)}

			{userSavedCount === 0 ? (
				<div className="bg-white border-4 border-eb-900 p-12 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)] text-center">
					<div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center border-2 border-eb-900 bg-coral-100">
						<Library className="w-8 h-8 text-eb-900" />
					</div>
					<h3 className="text-3xl font-black tracking-tighter mb-3">
						{content.libraryEmptyTitle}
					</h3>
					<p className="text-sm font-bold text-eb-900/70 max-w-xl mx-auto mb-8 leading-relaxed">
						{content.libraryEmptySubtitle}
					</p>
					<div className="flex flex-wrap items-center justify-center gap-3">
						{folderStatus === "none" && (
							<button
								onClick={() => void handleChooseLibraryFolder()}
								className="inline-flex items-center gap-3 bg-white text-eb-900 px-8 h-14 border-2 border-eb-900 text-xs font-black shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
							>
								<FolderOpen className="w-4 h-4" /> {content.chooseLibraryFolder}
							</button>
						)}
						{folderStatus === "needs-permission" && (
							<button
								onClick={() => void handleReconnectLibraryFolder()}
								className="inline-flex items-center gap-3 bg-white text-eb-900 px-8 h-14 border-2 border-eb-900 text-xs font-black shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
							>
								<FolderOpen className="w-4 h-4" />{" "}
								{content.reconnectLibraryFolder}
							</button>
						)}
						<button
							onClick={() => navigate("/")}
							className="inline-flex items-center gap-3 bg-eb-900 text-eb-50 px-8 h-14 border-2 border-eb-900 text-xs font-black shadow-[6px_6px_0px_0px_rgba(255,207,214,1)] hover:shadow-none hover:translate-x-[2px] hover:translate-y-[2px] transition-all"
						>
							<Wand2 className="w-4 h-4" /> {content.libraryEmptyCta}
						</button>
					</div>
				</div>
			) : (
				<div>
					<div className="flex items-center gap-4 mb-10">
						<div className="bg-tsb text-eb-50 px-4 py-2 text-sm font-black">
							{content.yourSavedVisions}
						</div>
						<div className="h-0.5 flex-1 bg-eb-900/10" />
					</div>
					{libraryByDate.map(([dateKey, entries]) => (
						<div key={dateKey} className="mb-16 last:mb-0">
							<div className="flex items-center gap-4 mb-6">
								<div className="border-2 border-eb-900 bg-white px-4 py-2 text-xs font-black tracking-tight">
									{formatDateHeader(dateKey)}
								</div>
								<div className="text-xs font-black text-eb-900/60 uppercase tracking-widest">
									{entries.length}{" "}
									{entries.length === 1
										? content.visionCountSingular
										: content.visionsCount}
								</div>
								<div className="h-0.5 flex-1 bg-eb-900/10" />
							</div>
							<div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8 lg:gap-12">
								{entries.map((item) => (
									<LibraryEntryCard
										key={item.id}
										item={item}
										thumbUrl={thumbCache[item.id] ?? item.dataUrl ?? null}
										language={language}
										content={content}
										onOpenInEditor={handleOpenLibraryEntry}
										onDownload={handleDownloadLibraryEntry}
										onDelete={(id) => void removeFromLibrary(id)}
									/>
								))}
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
