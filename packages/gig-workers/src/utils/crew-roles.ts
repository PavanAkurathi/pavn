function toTitleCase(value: string): string {
    return value
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

export function canonicalizeCrewRole(raw: string | null | undefined): string | null {
    if (!raw) {
        return null;
    }

    const normalized = raw
        .replace(/[_/]+/g, " ")
        .replace(/-/g, " ")
        .trim()
        .replace(/\s+/g, " ");

    if (!normalized) {
        return null;
    }

    return toTitleCase(normalized);
}

export function deriveCrewRoles(
    explicitRoles: Array<string | null | undefined>,
    fallbackRole?: string | null
): string[] {
    const roleSet = new Set<string>();

    for (const role of explicitRoles) {
        const normalized = canonicalizeCrewRole(role);
        if (normalized) {
            roleSet.add(normalized);
        }
    }

    const fallback = canonicalizeCrewRole(fallbackRole);
    if (fallback) {
        roleSet.add(fallback);
    }

    if (roleSet.size === 0) {
        roleSet.add("General");
    }

    return Array.from(roleSet);
}
