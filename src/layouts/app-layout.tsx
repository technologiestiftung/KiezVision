import React from "react";
import { AnimatePresence } from "motion/react";
import { Outlet, useLocation } from "react-router-dom";
import { AppHeader } from "../components/header/app-header.tsx";
import { SiteFooter } from "../components/footer/site-footer.tsx";
import { ProcessingOverlay } from "../components/primitives/overlays/processing-overlay.tsx";
import { ImagerySelectionModal } from "../components/imagery/imagery-selection-modal.tsx";
import { LeaveEditorDialog } from "../components/dialogs/leave-editor-dialog.tsx";
import { CameraCaptureDialog } from "../components/dialogs/camera-capture-dialog.tsx";
import { ErrorToast } from "../components/error/error-toast.tsx";
import { useAppContext } from "../context/app-context.tsx";
import { pathnameToView } from "../routes/path-utils.ts";
import { useModalInert } from "../hooks/use-modal-inert.ts";

export const AppLayout: React.FC = () => {
	const location = useLocation();
	const view = pathnameToView(location.pathname);
	const {
		language,
		setLanguage,
		content,
		processing,
		error,
		setError,
		editor,
		imageryPickerOpen,
		imageryPickerLocation,
		imageryPickerCandidates,
		imageryPickerRadiusM,
		imageryPickerStrings,
		setImageryPickerOpen,
		handleImageryConfirm,
		cameraOpen,
		cameraVideoRef,
		cameraModalRef,
		closeCamera,
		capturePhotoFromVideo,
		handleSaveToLibrary,
		handleDownloadCurrentImage,
	} = useAppContext();

	const modalOpen =
		imageryPickerOpen || cameraOpen || editor.showLeaveEditorConfirm;
	useModalInert(modalOpen);

	return (
		<div className="min-h-screen bg-eb-50 text-eb-900 font-sans selection:bg-eb-900 selection:text-eb-50 flex flex-col">
			<a href="#main-content" className="skip-link">
				{language === "en"
					? "Skip to main content"
					: "Zum Hauptinhalt springen"}
			</a>

			<AppHeader
				language={language}
				content={content}
				view={view}
				editMode={editor.editMode}
				originalImage={editor.originalImage}
				currentImage={editor.currentImage}
				onGoHome={() => editor.requestLeaveEditor("/")}
				onGoAbout={() => editor.requestLeaveEditor("/about")}
				onGoLibrary={() => editor.requestLeaveEditor("/library")}
				onSetEditModeComparison={() => editor.setEditMode("comparison")}
				onSetEditModeMask={editor.enterMaskMode}
				onSave={() => void handleSaveToLibrary()}
				onDownload={handleDownloadCurrentImage}
				onSetLanguage={setLanguage}
			/>

			<main id="main-content" className="w-full p-0 relative flex-1">
				<div aria-live="polite" aria-atomic="true" className="sr-only">
					{processing.isProcessing ? processing.statusMessage : ""}
				</div>

				{processing.isProcessing && view !== "editor" && (
					<ProcessingOverlay
						title={content.fetchingStreet}
						statusMessage={processing.statusMessage}
					/>
				)}

				<Outlet />
			</main>

			<SiteFooter language={language} />

			<AnimatePresence>
				{cameraOpen && (
					<CameraCaptureDialog
						language={language}
						modalRef={cameraModalRef}
						videoRef={cameraVideoRef}
						cancelLabel={content.cancelCamera}
						takePhotoLabel={content.takePhoto}
						onCancel={closeCamera}
						onCapture={capturePhotoFromVideo}
					/>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{editor.showLeaveEditorConfirm && (
					<LeaveEditorDialog
						language={language}
						dialogRef={editor.leaveDialogRef}
						onCancel={editor.cancelLeaveEditor}
						onConfirm={editor.confirmLeaveEditor}
					/>
				)}
			</AnimatePresence>

			{imageryPickerOpen && imageryPickerLocation && (
				<ImagerySelectionModal
					open={imageryPickerOpen}
					initialLocation={imageryPickerLocation}
					initialCandidates={imageryPickerCandidates}
					initialSearchRadiusM={imageryPickerRadiusM}
					strings={imageryPickerStrings}
					onClose={() => setImageryPickerOpen(false)}
					onConfirm={(payload) => void handleImageryConfirm(payload)}
				/>
			)}

			{error && (
				<ErrorToast
					message={error}
					language={language}
					onDismiss={() => setError(null)}
				/>
			)}
		</div>
	);
};
