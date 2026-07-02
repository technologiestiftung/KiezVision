function maxNeighborAlpha(options: {
	cur: Uint8Array;
	width: number;
	height: number;
	x: number;
	y: number;
}): number {
	const { cur, width, height, x, y } = options;
	let m = cur[y * width + x];
	for (let dy = -1; dy <= 1; dy++) {
		const yy = y + dy;
		if (yy < 0 || yy >= height) continue;
		const row = yy * width;
		for (let dx = -1; dx <= 1; dx++) {
			const xx = x + dx;
			if (xx < 0 || xx >= width) continue;
			const v = cur[row + xx];
			if (v > m) m = v;
		}
	}
	return m;
}

function clampAxis(value: number, max: number): number {
	if (value < 0) return 0;
	if (value >= max) return max - 1;
	return value;
}

function clampByte(v: number): number {
	if (v < 0) return 0;
	if (v > 255) return 255;
	return v;
}

/** 3×3 max dilation on mask alpha — expands matte slightly so generated objects are not hard-clipped at brush edges. */
export function dilateMaskAlpha(options: {
	data: Uint8ClampedArray;
	width: number;
	height: number;
	iterations: number;
}): void {
	const { data, width, height, iterations } = options;
	if (iterations <= 0) return;
	const len = width * height;
	const cur = new Uint8Array(len);
	const next = new Uint8Array(len);
	for (let i = 0, p = 0; p < len; i += 4, p++) {
		cur[p] = data[i + 3];
	}
	for (let iter = 0; iter < iterations; iter++) {
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				next[y * width + x] = maxNeighborAlpha({
					cur,
					width,
					height,
					x,
					y,
				});
			}
		}
		cur.set(next);
	}
	for (let i = 0, p = 0; p < len; i += 4, p++) {
		data[i + 3] = cur[p];
	}
}

/** Separable 5-tap binomial blur on alpha only — softens the matte so the pasted edit blends into the original at the boundary. */
export function featherMaskAlphaGaussian(options: {
	data: Uint8ClampedArray;
	width: number;
	height: number;
	horizontalVerticalCycles: number;
}): void {
	const { data, width, height, horizontalVerticalCycles } = options;
	if (horizontalVerticalCycles <= 0) return;
	const len = width * height;
	const a = new Float32Array(len);
	const b = new Float32Array(len);
	for (let i = 0, p = 0; p < len; i += 4, p++) {
		a[p] = data[i + 3];
	}
	const k0 = 1 / 16;
	const k1 = 4 / 16;
	const k2 = 6 / 16;
	const clampX = (x: number) => clampAxis(x, width);
	const clampY = (y: number) => clampAxis(y, height);

	for (let c = 0; c < horizontalVerticalCycles; c++) {
		for (let y = 0; y < height; y++) {
			const row = y * width;
			for (let x = 0; x < width; x++) {
				const s =
					k0 * a[row + clampX(x - 2)] +
					k1 * a[row + clampX(x - 1)] +
					k2 * a[row + x] +
					k1 * a[row + clampX(x + 1)] +
					k0 * a[row + clampX(x + 2)];
				b[row + x] = s;
			}
		}
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				const s =
					k0 * b[clampY(y - 2) * width + x] +
					k1 * b[clampY(y - 1) * width + x] +
					k2 * b[y * width + x] +
					k1 * b[clampY(y + 1) * width + x] +
					k0 * b[clampY(y + 2) * width + x];
				a[y * width + x] = s;
			}
		}
	}
	for (let i = 0, p = 0; p < len; i += 4, p++) {
		data[i + 3] = clampByte(Math.round(a[p]));
	}
}
