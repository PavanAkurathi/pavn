import { beforeEach, describe, expect, mock, test } from "bun:test";
import { department as departmentTable, organization as organizationTable } from "@repo/database/schema";

type Dept = { id: string; organizationId: string; name: string; roles: string[]; sortOrder: number };

let org: Record<string, unknown> | undefined;
let departments: Dept[] = [];
let nameClash = false;
const orgUpdates: Record<string, unknown>[] = [];

const sorted = () => [...departments].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));

const mockDb = {
    query: {
        organization: { findFirst: mock(() => Promise.resolve(org)) },
        department: {
            // The name check is the only findFirst outside the setup transaction.
            findFirst: mock(() => Promise.resolve(nameClash ? { id: "dep_other" } : undefined)),
            findMany: mock((args: { limit?: number }) =>
                Promise.resolve(args?.limit ? [...departments].sort((a, b) => b.sortOrder - a.sortOrder).slice(0, args.limit) : sorted()),
            ),
        },
    },
    update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
            where: () => {
                if (table === organizationTable) {
                    orgUpdates.push(values);
                    Object.assign(org!, values);
                    return Promise.resolve();
                }
                const target = departments.find((d) => d.id === targetId);
                if (target) Object.assign(target, values);
                return { returning: () => Promise.resolve(target ? [target] : []) };
            },
        }),
    }),
    insert: (table: unknown) => ({
        values: (rows: Dept | Dept[]) => {
            expect(table).toBe(departmentTable);
            const list = Array.isArray(rows) ? rows : [rows];
            departments.push(...list);
            return Object.assign(Promise.resolve(), { returning: () => Promise.resolve(list) });
        },
    }),
    delete: () => ({
        where: () => ({
            returning: () => {
                const target = departments.find((d) => d.id === targetId);
                departments = departments.filter((d) => d !== target);
                return Promise.resolve(target ? [{ id: target.id }] : []);
            },
        }),
    }),
    transaction: async (fn: (tx: unknown) => Promise<void>) =>
        fn({
            ...mockDb,
            query: {
                ...mockDb.query,
                department: { findFirst: () => Promise.resolve(departments[0]) },
            },
        }),
};

// Update and delete filter by id inside a drizzle expression the mock can't read,
// so each test names the row it means.
let targetId = "";

mock.module("@repo/database", () => ({ db: mockDb }));

const {
    applySchedulingSetup,
    canonicalDepartmentRoles,
    createDepartment,
    deleteDepartment,
    getSchedulingSettings,
    updateDepartment,
    updateSchedulingSettings,
} = await import("../src/modules/scheduler/settings");

beforeEach(() => {
    org = {
        businessType: null,
        scheduleStyle: "steady",
        openShiftClaimPolicy: "approval",
        swapApprovalRequired: true,
        weekStartsOn: 0,
        regionalOvertimePolicy: "weekly_40",
    };
    departments = [];
    nameClash = false;
    orgUpdates.length = 0;
    targetId = "";
});

describe("canonicalDepartmentRoles", () => {
    test("uses the roster's spelling, keeps order and drops repeats", () => {
        expect(canonicalDepartmentRoles(["line_cook", " server ", "Server", "", "prep-cook"])).toEqual([
            "Line Cook",
            "Server",
            "Prep Cook",
        ]);
    });
});

describe("getSchedulingSettings", () => {
    test("reports an unanswered setup and maps the overtime rule", async () => {
        org!.regionalOvertimePolicy = "daily_8";
        const settings = await getSchedulingSettings("org_1");
        expect(settings).toEqual({
            businessType: null,
            scheduleStyle: "steady",
            openShiftClaimPolicy: "approval",
            swapApprovalRequired: true,
            weekStartsOn: 0,
            overtimePolicy: "daily_8",
            departments: [],
        });
    });

    test("is a 404 for an unknown organization", async () => {
        org = undefined;
        await expect(getSchedulingSettings("org_x")).rejects.toMatchObject({ code: "ORG_NOT_FOUND", statusCode: 404 });
    });
});

describe("applySchedulingSetup", () => {
    test("saves the answers and seeds the business type's departments", async () => {
        const settings = await applySchedulingSetup("org_1", {
            businessType: "retail",
            scheduleStyle: "events",
            openShiftClaimPolicy: "auto",
        });

        expect(orgUpdates).toEqual([{ businessType: "retail", scheduleStyle: "events", openShiftClaimPolicy: "auto" }]);
        expect(settings.departments.map((d) => [d.name, d.roles, d.sortOrder])).toEqual([
            ["Sales floor", ["Cashier", "Sales Associate"], 0],
            ["Stock", ["Stock Associate"], 1],
            ["Leads", ["Shift Lead"], 2],
        ]);
        expect(settings.departments.every((d) => d.id.startsWith("dep_"))).toBe(true);
    });

    test("never overwrites departments that already exist", async () => {
        departments = [{ id: "dep_mine", organizationId: "org_1", name: "Floor", roles: ["Greeter"], sortOrder: 0 }];

        const settings = await applySchedulingSetup("org_1", {
            businessType: "restaurant",
            scheduleStyle: "steady",
            openShiftClaimPolicy: "approval",
        });

        expect(settings.businessType).toBe("restaurant");
        expect(settings.departments.map((d) => d.name)).toEqual(["Floor"]);
    });

    test("rejects an answer that isn't one of the choices", async () => {
        await expect(
            applySchedulingSetup("org_1", { businessType: "spaceport", scheduleStyle: "steady", openShiftClaimPolicy: "approval" }),
        ).rejects.toMatchObject({ code: "VALIDATION_ERROR", statusCode: 400 });
        expect(orgUpdates).toHaveLength(0);
    });
});

describe("updateSchedulingSettings", () => {
    test("stores the overtime rule where reporting already reads it", async () => {
        const settings = await updateSchedulingSettings("org_1", { overtimePolicy: "daily_8", weekStartsOn: 1 });
        expect(orgUpdates).toEqual([{ weekStartsOn: 1, regionalOvertimePolicy: "daily_8" }]);
        expect(settings).toMatchObject({ overtimePolicy: "daily_8", weekStartsOn: 1 });
    });

    test("rejects an empty change and an out-of-range week start", async () => {
        await expect(updateSchedulingSettings("org_1", {})).rejects.toMatchObject({ statusCode: 400 });
        await expect(updateSchedulingSettings("org_1", { weekStartsOn: 7 })).rejects.toMatchObject({ statusCode: 400 });
        await expect(updateSchedulingSettings("org_1", { name: "x" })).rejects.toMatchObject({ statusCode: 400 });
    });
});

describe("departments", () => {
    test("a new department goes last, with canonical roles", async () => {
        departments = [{ id: "dep_a", organizationId: "org_1", name: "Kitchen", roles: [], sortOrder: 3 }];
        const created = await createDepartment("org_1", { name: "Bar", roles: ["bartender", "Barback", "BARTENDER"] });
        expect(created).toMatchObject({ name: "Bar", roles: ["Bartender", "Barback"], sortOrder: 4 });
    });

    test("names are unique within the organization", async () => {
        nameClash = true;
        await expect(createDepartment("org_1", { name: "kitchen" })).rejects.toMatchObject({
            code: "DEPARTMENT_NAME_TAKEN",
            statusCode: 409,
        });
    });

    test("rename, re-role and reorder one department", async () => {
        departments = [{ id: "dep_a", organizationId: "org_1", name: "Kitchen", roles: ["Cook"], sortOrder: 0 }];
        targetId = "dep_a";
        const updated = await updateDepartment("org_1", "dep_a", { name: "Back of house", roles: ["dish washer"], sortOrder: 2 });
        expect(updated).toEqual({ id: "dep_a", name: "Back of house", roles: ["Dish Washer"], sortOrder: 2 });
    });

    test("a department outside the organization is a 404", async () => {
        targetId = "dep_elsewhere";
        await expect(updateDepartment("org_1", "dep_elsewhere", { name: "X" })).rejects.toMatchObject({ statusCode: 404 });
        await expect(deleteDepartment("org_1", "dep_elsewhere")).rejects.toMatchObject({ statusCode: 404 });
    });

    test("delete removes it", async () => {
        departments = [{ id: "dep_a", organizationId: "org_1", name: "Kitchen", roles: [], sortOrder: 0 }];
        targetId = "dep_a";
        expect(await deleteDepartment("org_1", "dep_a")).toEqual({ id: "dep_a" });
        expect(departments).toHaveLength(0);
    });
});
