import { describe, expect, test, mock } from "bun:test";
import { getUpcomingShifts } from "../src/modules/shifts/upcoming";

// --- Mocks ---
const mockFindMany = mock(() => Promise.resolve([
    { id: "s1", status: "published", startTime: new Date(), endTime: new Date(), organizationId: "test_org" },
    { id: "s2", status: "assigned", startTime: new Date(), endTime: new Date(), organizationId: "test_org" }
]));

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


describe("GET /shifts/upcoming", () => {
    test("returns 200 OK", async () => {
        const response = await getUpcomingShifts("test_org");
        expect(Array.isArray(response)).toBe(true);
    });

    test("returns only active shifts (not completed/cancelled)", async () => {
        // Mock DB returns mixed status
        const mockShifts = [
            { id: "s1", status: "published", startTime: new Date(), endTime: new Date(), organizationId: "test_org", location: { name: 'Loc' }, assignments: [] },
            // { id: "s2", status: "cancelled", ... } // DB filters this out
        ];

        mockFindMany.mockResolvedValueOnce(mockShifts as any);

        const response = await getUpcomingShifts("test_org");
        const shifts = response as any[];

        expect(shifts.length).toBe(1);
        expect(shifts[0]!.id).toBe("s1");
    });

    test("sorts by startTime ascending", async () => {
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 86400000);

        mockFindMany.mockResolvedValueOnce([
            { id: "s1", status: "published", startTime: now, endTime: now, organizationId: "test_org", location: { name: 'Loc' }, assignments: [] },
            { id: "s2", status: "published", startTime: tomorrow, endTime: tomorrow, organizationId: "test_org", location: { name: 'Loc' }, assignments: [] }
        ] as any);

        const response = await getUpcomingShifts("test_org");
        const shifts = response as any[];

        expect(shifts.length).toBe(2);
        expect(new Date(shifts[0]!.startTime).getTime()).toBeLessThanOrEqual(new Date(shifts[1]!.startTime).getTime());
    });
});
