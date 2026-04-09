export interface ShiftRoleTone {
    surface: string;
    dot: string;
    ring: string;
    accent: string;
}

function resolveRoleColor(role: string) {
    const lowerRole = role.toLowerCase();

    if (lowerRole.includes("server")) return "bg-role-server";
    if (lowerRole.includes("bartender")) return "bg-role-bartender";
    if (lowerRole.includes("kitchen") || lowerRole.includes("chef") || lowerRole.includes("cook")) return "bg-role-kitchen";
    if (lowerRole.includes("host")) return "bg-role-host";
    if (lowerRole.includes("busser") || lowerRole.includes("runner") || lowerRole.includes("support")) return "bg-role-support";

    return "bg-role-default";
}

export function getShiftRoleTone(role: string): ShiftRoleTone {
    const background = resolveRoleColor(role);
    const colorName = background.replace("bg-", "");

    return {
        surface: `${background} text-role-foreground`,
        dot: background,
        ring: `ring-${colorName}`,
        accent: "bg-role-foreground/12",
    };
}
