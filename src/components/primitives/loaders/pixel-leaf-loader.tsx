import React from "react";
import { motion } from "motion/react";

const PIXEL_CLASS: Record<number, string> = {
	1: "bg-emerald-400",
	2: "bg-emerald-700",
	3: "bg-eb-900",
};

export const PixelLeafLoader = () => {
	// A simple 10x10 grid representing a leaf shape
	// 0 = empty, 1 = light green, 2 = dark green
	const leafGrid = [
		[0, 0, 0, 3, 3, 3, 3, 0, 0, 0],
		[0, 0, 3, 1, 2, 2, 1, 3, 0, 0],
		[0, 3, 1, 2, 2, 2, 2, 1, 3, 0],
		[3, 1, 2, 2, 2, 2, 2, 2, 1, 3],
		[3, 2, 2, 2, 2, 2, 2, 2, 2, 3],
		[3, 1, 2, 2, 2, 2, 2, 2, 1, 3],
		[0, 3, 1, 2, 2, 2, 2, 1, 3, 0],
		[0, 0, 3, 1, 2, 2, 1, 3, 0, 3],
		[0, 0, 0, 3, 1, 2, 3, 0, 3, 1],
		[0, 0, 0, 0, 3, 3, 0, 0, 3, 3],
	];

	return (
		<div
			aria-hidden="true"
			className="grid grid-cols-10 gap-0 w-48 h-48 mx-auto"
		>
			{leafGrid.flat().map((pixel, i) => {
				const x = i % 10;
				const y = Math.floor(i / 10);

				return (
					<motion.div
						key={i}
						initial={{ opacity: 0, scale: 0 }}
						animate={{
							opacity: pixel > 0 ? 1 : 0,
							scale: pixel > 0 ? 1 : 0,
						}}
						transition={{
							delay: (x + y) * 0.1,
							duration: 0.4,
							repeat: Infinity,
							repeatType: "mirror",
						}}
						className={`w-full h-full ${PIXEL_CLASS[pixel] ?? "bg-transparent"}`}
					/>
				);
			})}
		</div>
	);
};
