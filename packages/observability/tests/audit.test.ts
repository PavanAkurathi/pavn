
import { describe, expect, test, mock, beforeEach, spyOn } from "bun:test";
import { logAudit, logShiftChange } from "../src/audit";

// Mock DB
const mockInsert = mock(() => ({
    values: mockValues
}));
const mockValues = mock(() => Promise.resolve());

mock.module("@repo/database", () => ({
    db: {
        insert: mockInsert
    }
}));

describe("Audit Logging", () => {
    beforeEach(() => {
        mockValues.mockClear();
        mockInsert.mockClear();
    });

    test("logAudit inserts record with correct fields", async () => {
        await logAudit({
            organizationId: "org_1",
            entityType: "shift",
            entityId: "shift_1",
            action: "create",
            userId: "user_1",
            changes: { before: {}, after: { status: "draft" } }
        });

        expect(mockInsert).toHaveBeenCalled();
        expect(mockValues).toHaveBeenCalled();
        const args = (mockValues.mock.calls as any)[0][0];
        expect(args.organizationId).toBe("org_1");
        expect(args.entityType).toBe("shift");
        expect(args.action).toBe("create");
        expect(args.changes.after.status).toBe("draft");
    });

    test("logShiftChange helper formats data correctly", async () => {
        await logShiftChange(
            "shift_2",
            "org_2",
            "update",
            "user_2",
            "John Manager",
            { status: "draft" },
            { status: "published" }
        );

        expect(mockValues).toHaveBeenCalled();
        const args = (mockValues.mock.calls as any)[0][0];
        expect(args.entityType).toBe("shift");
        expect(args.entityId).toBe("shift_2");
        expect(args.userName).toBe("John Manager");
        expect(args.changes.before.status).toBe("draft");
    });

    test("logAudit skips if organizationId missing", async () => {
        const consoleSpy = spyOn(console, "warn").mockImplementation(() => { });

        await logAudit({
            entityType: "shift",
            entityId: "shift_3",
            action: "delete"
        } as any);

        expect(mockInsert).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
    });
});
