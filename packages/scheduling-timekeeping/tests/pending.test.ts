import { describe, expect, test, mock } from "bun:test";
import { getPendingShifts } from "../src/modules/shifts/pending";

// --- Mocks ---
const mockFindMany = mock(() => Promise.resolve([] as any[]));

mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: {
                findMany: mockFindMany
            }
        }
    },
    shift: { status: 'status', organizationId: 'orgId', startTime: new Date(), endTime: new Date() },
    shiftAssignment: {}
}));

import { Shift } from "../src/types";


describe("GET /shifts/pending-approval", () => {
    test("returns pending shifts response", async () => {
        mockFindMany.mockResolvedValueOnce([
            { id: "s1", status: "completed", startTime: new Date(), endTime: new Date(), organizationId: "test_org" }
        ]);

        const response = await getPendingShifts("test_org");
        expect(response.length).toBe(1);
        expect(response[0]!.id).toBe("s1");
    });
});
