export const BASE36_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * Encodes a number into a Base36 string of a specific length.
 */
export function encodeBase36(value: number, length: number): string {
    let result = "";
    let n = value;
    while (n > 0) {
        result = BASE36_ALPHABET[n % 36] + result;
        n = Math.floor(n / 36);
    }
    return result.padStart(length, "0");
}

/**
 * Generates the unified 3-character random suffix.
 */
export function random3Char(): string {
    let result = "";
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * 36);
        result += BASE36_ALPHABET[randomIndex];
    }
    return result;
}

/**
 * AGENTABLE Row ID: 9 Chars Time (Base36) + 3 Chars Random
 */
export function generateRowId(): string {
    const timestamp = Date.now();
    return encodeBase36(timestamp, 9) + random3Char();
}

/**
 * AGENTABLE Schema IDs
 */
export const generateColId = () => `col_${random3Char()}` as const;
export const generateViewId = () => `view_${random3Char()}` as const;
export const generateFilterId = () => `flt_${random3Char()}` as const;
