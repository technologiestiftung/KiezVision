import React, { type RefObject } from "react";
import { motion } from "motion/react";
import type { Language } from "../../content.ts";
import { SecondaryButton } from "../primitives/buttons/secondary-button.tsx";
import { PrimaryButton } from "../primitives/buttons/primary-button.tsx";

export interface LeaveEditorDialogProps {
	language: Language;
	dialogRef: RefObject<HTMLDivElement | null>;
	onCancel: () => void;
	onConfirm: () => void;
}

export const LeaveEditorDialog: React.FC<LeaveEditorDialogProps> = ({
	language,
	dialogRef,
	onCancel,
	onConfirm,
}) => (
	<motion.div
		initial={{ opacity: 0 }}
		animate={{ opacity: 1 }}
		exit={{ opacity: 0 }}
		className="fixed inset-0 z-[250] flex items-center justify-center bg-eb-900/70 backdrop-blur-sm p-6"
	>
		<motion.div
			ref={dialogRef}
			initial={{ y: 12, scale: 0.98, opacity: 0 }}
			animate={{ y: 0, scale: 1, opacity: 1 }}
			exit={{ y: 12, scale: 0.98, opacity: 0 }}
			className="w-full max-w-lg bg-white border-4 border-eb-900 shadow-[12px_12px_0px_0px_rgba(255,207,214,1)]"
			role="dialog"
			aria-modal="true"
			aria-labelledby="leave-dialog-title"
		>
			<div className="border-b-4 border-eb-900 bg-kv-chrome px-6 py-4">
				<h3
					id="leave-dialog-title"
					className="text-xl font-black tracking-tighter"
				>
					{language === "en" ? "Leave editor?" : "Editor verlassen?"}
				</h3>
			</div>
			<div className="px-6 py-5">
				<p className="text-sm font-bold text-eb-900/80 leading-relaxed">
					{language === "en"
						? "If you leave now, all changes will be lost unless you Save or Download."
						: "Wenn Sie jetzt verlassen, gehen alle Änderungen verloren, sofern Sie nicht speichern oder herunterladen."}
				</p>
			</div>
			<div className="px-6 pb-6 flex items-center justify-end gap-3">
				<SecondaryButton onClick={onCancel} className="px-6 h-12 text-xs">
					{language === "en" ? "Cancel" : "Abbrechen"}
				</SecondaryButton>
				<PrimaryButton onClick={onConfirm} className="px-6 h-12 text-xs">
					{language === "en" ? "Confirm" : "Bestätigen"}
				</PrimaryButton>
			</div>
		</motion.div>
	</motion.div>
);
