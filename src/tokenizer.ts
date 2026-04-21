export function estimateTokens(text: string): number {
	return Math.ceil(text.length / 4);
}

export function formatTokenCount(n: number): string {
	if (n >= 1_000_000) {
		const val = n / 1_000_000;
		return val.toFixed(1).replace(/\.0$/, "") + "M";
	}
	if (n >= 1_000) {
		const val = n / 1_000;
		return val.toFixed(1).replace(/\.0$/, "") + "k";
	}
	return String(n);
}
