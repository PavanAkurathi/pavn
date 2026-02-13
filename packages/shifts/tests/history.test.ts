import { describe, expect, test, mock } from "bun:test";
import { getHistoryShifts } from "../src/modules/shifts/history";
import { Shift } from "../src/types";


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

describe("GET /shifts/history", () => {
    test("returns history shifts response", async () => {
        mockFindMany.mockResolvedValueOnce([
            { id: "h1", status: "completed", startTime: new Date(), endTime: new Date(), organizationId: "test_org" }
        ]);

        const response = await getHistoryShifts("test_org", { limit: 10, offset: 0 });
        expect(response.length).toBe(1);
        expect(response[0]!.id).toBe("h1");
    });
});
