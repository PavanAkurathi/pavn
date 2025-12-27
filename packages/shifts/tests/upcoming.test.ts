import { describe, expect, test } from "bun:test";
import { getUpcomingShifts } from "../src/controllers/upcoming";

describe("GET /shifts/upcoming", () => {
    test("returns 200 OK", async () => {
        const response = getUpcomingShifts();
        expect(response.status).toBe(200);
    });

    test("returns only active shifts (not completed/cancelled)", async () => {
        const response = getUpcomingShifts();
        const shifts = await response.json();

        // Check that we got some shifts
        expect(shifts.length).toBeGreaterThan(0);

        // Check that none are completed or cancelled
        const invalidShifts = shifts.filter((s: any) =>
            s.status === 'completed' || s.status === 'cancelled'
        );
        expect(invalidShifts.length).toBe(0);
    });

    test("sorts by startTime ascending", async () => {
        const response = getUpcomingShifts();
        const shifts = await response.json();

        for (let i = 0; i < shifts.length - 1; i++) {
            const current = new Date(shifts[i].startTime).getTime();
            const next = new Date(shifts[i + 1].startTime).getTime();
            expect(current).toBeLessThanOrEqual(next);
        }
    });
});
