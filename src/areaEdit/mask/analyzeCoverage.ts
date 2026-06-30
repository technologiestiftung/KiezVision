/** Returns [editableCount, totalPixels, editableFraction] for hard BW mask rendered on canvas. */
export function measureMaskCoverage(options: {
	maskImg: HTMLImageElement;
	width: number;
	height: number;
	editableLumAbove: number;
}): [number, number, number] {
	const { maskImg, width, height, editableLumAbove } = options;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const ctx = canvas.getContext("2d");
	if (!ctx) return [0, width * height, 0];
	ctx.drawImage(maskImg, 0, 0, width, height);
	const id = ctx.getImageData(0, 0, width, height);
	const d = id.data;
	let editable = 0;
	const total = width * height;
	for (let i = 0; i < d.length; i += 4) {
		const lum = (d[i] + d[i + 1] + d[i + 2]) / 3;
		if (lum > editableLumAbove) editable++;
	}
	return [editable, total, editable / total];
}
