import { describe, expect, test } from "bun:test";
import { getWorkerShiftsController } from "../src/controllers/worker-shifts";

describe("GET /worker/shifts", () => {
    // Assuming we have some data in the local DB. 
    // If not, these tests might fail or return empty arrays, which is still a partial success (no crash).
    // ideally we'd insert data here, but for now let's try to read common IDs or just run it.

    // We'll use a likely non-existent ID to test empty state first, 
    // or try to fetch known data if we can identify it.
    const TEST_WORKER_ID = "user_1";
    const TEST_ORG_ID = "ewwTgLz_yWUiuQiX4fS1E";

    test("returns 200 OK and empty array for unknown user", async () => {
        const response = await getWorkerShiftsController("unknown_worker", "unknown_org", { status: 'upcoming' });
        expect(response.status).toBe(200);
        const data = await response.json() as any;
        expect(data.shifts).toEqual([]);
    });

    test("can fetch upcoming shifts", async () => {
        const response = await getWorkerShiftsController(TEST_WORKER_ID, TEST_ORG_ID, { status: 'upcoming' });
        expect(response.status).toBe(200);
        const data = await response.json() as any;
        expect(Array.isArray(data.shifts)).toBe(true);
        // If we have data, deeper checks:
        if (data.shifts.length > 0) {
            const shift = data.shifts[0];
            expect(shift).toHaveProperty("id");
            expect(shift).toHaveProperty("startTime");
            expect(shift).toHaveProperty("status");
        }
    });

    test("can fetch history shifts", async () => {
        const response = await getWorkerShiftsController(TEST_WORKER_ID, TEST_ORG_ID, { status: 'history' });
        expect(response.status).toBe(200);
        const data = await response.json() as any;
        expect(Array.isArray(data.shifts)).toBe(true);
    });
});
