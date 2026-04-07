/**
 * Generates the unified 3-character random suffix.
 */
export function random3Char(): string {
    return Math.floor(Math.random() * 46656).toString(36).padStart(3, "0");
}

/**
 * AGENTABLE Row ID: 9 Chars Time (Base36) + 3 Chars Random
 */
export function generateRowId(): string {
    return Date.now().toString(36).padStart(9, "0") + random3Char();
}

/**
 * AGENTABLE Schema IDs
 */
export const generateColId = () => `col_${random3Char()}` as const;
export const generateViewId = () => `view_${random3Char()}` as const;
export const generateFilterId = () => `flt_${random3Char()}` as const;
