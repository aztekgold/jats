export const CROCKFORD_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/**
 * Encodes a number into a Crockford Base32 string of a specific length.
 */
export function encodeBase32(value: number, length: number): string {
    let result = "";
    let n = value;
    while (n > 0) {
        result = CROCKFORD_ALPHABET[n % 32] + result;
        n = Math.floor(n / 32);
    }
    return result.padStart(length, "0");
}

/**
 * Generates the unified 3-character random suffix.
 */
export function random3Char(): string {
    let result = "";
    for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * 32);
        result += CROCKFORD_ALPHABET[randomIndex];
    }
    return result;
}

/**
 * JATS Row ID: 10 Chars Time (Crockford) + 3 Chars Random
 */
export function generateRowId(): string {
    const timestamp = Date.now();
    return encodeBase32(timestamp, 10) + random3Char();
}

/**
 * JATS Schema IDs
 */
export const generateColId = () => `col_${random3Char()}` as const;
export const generateViewId = () => `view_${random3Char()}` as const;
export const generateFilterId = () => `flt_${random3Char()}` as const;
