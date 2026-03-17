
/**
 * Generates initials from a name string.
 * - Unknown/Null -> "??"
 * - "John" -> "JO" (First 2 chars)
 * - "John Doe" -> "JD" (First and Last initial)
 * - "John von Doe" -> "JD" (First and Last initial)
 */
export const getInitials = (name?: string | null): string => {
    if (!name) return "??";

    const normalized = name.trim();
    if (normalized.length === 0) return "??";

    const parts = normalized.split(/\s+/);

    if (parts.length === 1) {
        return normalized.substring(0, 2).toUpperCase();
    }

    const first = parts[0]?.[0] || "";
    const last = parts[parts.length - 1]?.[0] || "";
    return (first + last).toUpperCase();
};
