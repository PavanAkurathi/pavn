
export interface Role {
    id: string;
    label: string;
}

export interface CrewMember {
    id: string;
    name: string;
    avatar: string;
    roles: string[];
    hours: number;
    initials: string;
}

export const ROLES: Role[] = [
    { id: "all", label: "All" },
    { id: "server", label: "Servers" },
    { id: "bartender", label: "Bartenders" },
    { id: "kitchen", label: "Kitchen" },
    { id: "host", label: "Host" },
];

export const AVAILABLE_CREW: CrewMember[] = [
    {
        id: "u1",
        name: "Mike Ross",
        avatar: "https://github.com/shadcn.png",
        roles: ["server", "bartender"],
        hours: 38,
        initials: "MR"
    },
    {
        id: "u2",
        name: "Sarah Jessica",
        avatar: "",
        roles: ["server"],
        hours: 12,
        initials: "SJ"
    },
    {
        id: "u3",
        name: "Jim Halpert",
        avatar: "",
        roles: ["kitchen", "cook"],
        hours: 42,
        initials: "JH"
    },
    {
        id: "u4",
        name: "Pam Beesly",
        avatar: "",
        roles: ["host"],
        hours: 32,
        initials: "PB"
    },
    {
        id: "u5",
        name: "Dwight Schrute",
        avatar: "",
        roles: ["all"],
        hours: 50,
        initials: "DS"
    },
];

export function useCrewData() {
    return {
        roles: ROLES,
        crew: AVAILABLE_CREW
    };
}
