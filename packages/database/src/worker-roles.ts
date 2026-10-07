const ROLE_SPLIT_REGEX = /[,;\n|]+/;

export function canonicalizeWorkerRole(raw: string | null | undefined): string | null {
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

    return normalized
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

export function normalizeWorkerRoles(
    raw: string | string[] | null | undefined
): string[] {
    if (!raw) {
        return [];
    }

    const values = Array.isArray(raw) ? raw : [raw];
    const roleSet = new Set<string>();

    for (const value of values) {
        if (!value) {
            continue;
        }

        const parts = String(value)
            .split(ROLE_SPLIT_REGEX)
            .map((part) => canonicalizeWorkerRole(part))
            .filter((part): part is string => Boolean(part));

        for (const part of parts) {
            roleSet.add(part);
        }
    }

    return Array.from(roleSet);
}

export function resolveWorkerRoleSet(input: {
    roles?: string | string[] | null;
    primaryRole?: string | null;
    fallbackRole?: string | null;
}): string[] {
    const ordered = new Set<string>();

    const primary = canonicalizeWorkerRole(input.primaryRole);
    if (primary) {
        ordered.add(primary);
    }

    for (const role of normalizeWorkerRoles(input.roles)) {
        ordered.add(role);
    }

    const fallback = canonicalizeWorkerRole(input.fallbackRole);
    if (fallback) {
        ordered.add(fallback);
    }

    return Array.from(ordered);
}
