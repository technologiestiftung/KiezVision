import React, { type RefObject } from "react";
import { motion } from "motion/react";
import type { Language } from "../../content.ts";
import { SecondaryButton } from "../primitives/buttons/secondary-button.tsx";
import { PrimaryButton } from "../primitives/buttons/primary-button.tsx";

export interface CameraCaptureDialogProps {
	language: Language;
	modalRef: RefObject<HTMLDivElement | null>;
	videoRef: RefObject<HTMLVideoElement | null>;
	cancelLabel: string;
	takePhotoLabel: string;
	onCancel: () => void;
	onCapture: () => void;
}

export const CameraCaptureDialog: React.FC<CameraCaptureDialogProps> = ({
	language,
	modalRef,
	videoRef,
	cancelLabel,
	takePhotoLabel,
	onCancel,
	onCapture,
}) => (
	<motion.div
		ref={modalRef}
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		role="dialog"
		aria-modal="true"
		aria-label={language === "en" ? "Camera capture" : "Kameraaufnahme"}
		className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-eb-900/92 backdrop-blur-sm p-4"
	>
		<video
			ref={videoRef}
			className="w-full max-w-2xl max-h-[min(70vh,640px)] rounded-lg border-4 border-eb-50 object-cover bg-black"
			muted
			playsInline
			autoPlay
			aria-label={
				language === "en" ? "Live camera preview" : "Live-Kameravorschau"
			}
		/>
		<div className="mt-6 flex flex-wrap items-center justify-center gap-4">
			<SecondaryButton onClick={onCancel} className="px-8 h-14 text-sm">
				{cancelLabel}
			</SecondaryButton>
			<PrimaryButton
				onClick={onCapture}
				className="px-8 h-14 text-sm bg-coral-500"
			>
				{takePhotoLabel}
			</PrimaryButton>
		</div>
	</motion.div>
);
