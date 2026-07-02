import { useNavigate } from "react-router-dom";
import { EditorEmptyState } from "../../components/editor/editor-empty-state.tsx";
import { EditorView } from "../../components/editor/editor-view.tsx";
import { useAppContext } from "../../context/app-context.tsx";

export default function EditPage() {
	const navigate = useNavigate();
	const {
		language,
		content,
		processing,
		searchQuery,
		editor,
		handleClearHistory,
		reopenImageryPicker,
	} = useAppContext();

	if (!editor.originalImage) {
		return (
			<EditorEmptyState
				navigate={navigate}
				title={content.editorNoImageTitle}
				subtitle={content.editorNoImageSubtitle}
				backLabel={content.backToHome}
				libraryLabel={content.library}
			/>
		);
	}

	return (
		<EditorView
			language={language}
			content={content}
			originalImage={editor.originalImage}
			currentImage={editor.currentImage}
			history={editor.history}
			editMode={editor.editMode}
			processing={processing}
			brushSize={editor.brushSize}
			isAreaEditEraser={editor.isAreaEditEraser}
			maskBase64={editor.maskBase64}
			inpaintMountKey={editor.inpaintMountKey}
			imageSource={editor.imageSource}
			locationLabel={
				editor.fetchedLocation || searchQuery || content.defaultLocation
			}
			mapillaryMetadata={editor.mapillaryMetadata}
			canvasRef={editor.canvasRef}
			onOverlayChange={editor.handleOverlayChange}
			onTransform={editor.handleTransform}
			onSelectVersion={editor.setCurrentImage}
			onBrushSizeChange={editor.setBrushSize}
			onSetBrush={() => editor.setIsAreaEditEraser(false)}
			onSetEraser={() => editor.setIsAreaEditEraser(true)}
			onClearHistory={handleClearHistory}
			onReopenImageryPicker={() => void reopenImageryPicker()}
		/>
	);
}
