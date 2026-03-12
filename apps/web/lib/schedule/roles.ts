export interface DynamicRoleOption {
    id: string;
    label: string;
}

function toTitleCase(value: string): string {
    return value
        .split(" ")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(" ");
}

export function canonicalizeRoleName(raw: string | null | undefined): string | null {
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
        const normalized = canonicalizeRoleName(role);
        if (normalized) {
            roleSet.add(normalized);
        }
    }

    const fallback = canonicalizeRoleName(fallbackRole);
    if (fallback) {
        roleSet.add(fallback);
    }

    if (roleSet.size === 0) {
        roleSet.add("General");
    }

    return Array.from(roleSet);
}

export function buildRoleOptions(
    crew: Array<{ roles?: string[] }>
): DynamicRoleOption[] {
    const roleSet = new Set<string>();

    for (const worker of crew) {
        for (const role of worker.roles || []) {
            const normalized = canonicalizeRoleName(role);
            if (normalized) {
                roleSet.add(normalized);
            }
        }
    }

    const sortedRoles = Array.from(roleSet).sort((a, b) => a.localeCompare(b));

    return [
        { id: "all", label: "All roles" },
        ...sortedRoles.map((role) => ({ id: role, label: role })),
    ];
}

export function getRoleLabel(roleId: string): string {
    if (roleId === "all") {
        return "All roles";
    }

    return canonicalizeRoleName(roleId) || "General";
}
