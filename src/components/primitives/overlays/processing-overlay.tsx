import React from "react";
import { motion } from "motion/react";
import { PixelLeafLoader } from "../loaders/pixel-leaf-loader.tsx";

export interface ProcessingOverlayProps {
	title: string;
	statusMessage?: string;
	variant?: "fullscreen" | "inline";
}

export const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({
	title,
	statusMessage,
	variant = "fullscreen",
}) => {
	if (variant === "inline") {
		return (
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				role="status"
				aria-label={statusMessage}
				className="absolute inset-0 z-40 bg-eb-50 flex flex-col items-center justify-center text-center p-8"
			>
				<div
					className="flex items-center justify-center mb-6 scale-75"
					aria-hidden="true"
				>
					<PixelLeafLoader />
				</div>
				<div className="text-eb-900 px-4 py-2 text-lg font-black tracking-tighter mb-2 italic uppercase">
					{statusMessage}
				</div>
				<div className="h-1 bg-eb-900 w-32 overflow-hidden shadow-[2px_2px_0_0_#FE4441]">
					<motion.div
						animate={{ left: ["-100%", "100%"] }}
						transition={{ duration: 1.5, repeat: Infinity }}
						className="relative h-full w-1/2 bg-coral-500"
					/>
				</div>
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
			exit={{ opacity: 0 }}
			role="status"
			aria-live="polite"
			aria-label={statusMessage || title}
			className="fixed inset-0 z-[100] bg-eb-50 flex flex-col items-center justify-center text-center p-8 overflow-hidden"
		>
			<div
				className="flex items-center justify-center mb-12 scale-125"
				aria-hidden="true"
			>
				<PixelLeafLoader />
			</div>
			<div className="mb-6 relative z-20 mx-10">
				<h2 className="text-4xl font-black tracking-tighter uppercase italic text-eb-900">
					{title}
				</h2>
			</div>
			<div className="flex flex-col gap-2 px-8 w-full max-w-md">
				<p className="text-xl font-bold text-eb-900 uppercase tracking-tight animate-pulse min-h-[3rem]">
					{statusMessage}
				</p>
				<div className="w-full h-3 bg-eb-900/10 border-2 border-eb-900 relative overflow-hidden">
					<motion.div
						animate={{ x: ["-100%", "100%"] }}
						transition={{
							duration: 2,
							repeat: Infinity,
							ease: "easeInOut",
						}}
						className="absolute inset-0 w-1/3 bg-coral-500"
					/>
				</div>
			</div>
		</motion.div>
	);
};
