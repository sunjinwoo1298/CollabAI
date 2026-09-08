/**
 * Curated palette of 10 visually distinct, high-contrast UI colors
 * optimized for dark canvas backgrounds and user presence cursors.
 */
export const COLLABORATION_PALETTE: readonly string[] = [
  "#6366F1", // Indigo
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EC4899", // Pink
  "#06B6D4", // Cyan
  "#8B5CF6", // Violet
  "#F97316", // Orange
  "#14B8A6", // Teal
  "#3B82F6", // Blue
  "#EF4444", // Rose
] as const;

/**
 * Deterministically maps any userId string to a fixed color from the collaboration palette.
 * - Same userId always produces the exact same color.
 * - Zero randomness, no database lookup, no server state.
 */
export function getDeterministicColor(userId: string): string {
  if (!userId) {
    return COLLABORATION_PALETTE[0];
  }

  // DJB2-inspired deterministic hash
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 33) ^ userId.charCodeAt(i);
  }

  const index = Math.abs(hash) % COLLABORATION_PALETTE.length;
  return COLLABORATION_PALETTE[index];
}
