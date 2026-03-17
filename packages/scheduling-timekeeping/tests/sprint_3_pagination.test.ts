
import { describe, expect, test, mock, beforeEach } from "bun:test";

// 1. Create the mock function first
const mockFindMany = mock(() => Promise.resolve([]));

// 2. Mock the module BEFORE importing the controller
mock.module("@repo/database", () => ({
    db: {
        query: {
            shift: {
                findMany: mockFindMany
            }
        }
    }
}));

// 3. Import the controller AFTER mocking the module
import { getHistoryShifts } from "../src/modules/shifts/history";

describe("WH-115: History Pagination", () => {
    beforeEach(() => {
        mockFindMany.mockClear();
        mockFindMany.mockResolvedValue([]);
    });

    test("passes limit and offset to database query", async () => {
        await getHistoryShifts("org_1", { limit: 10, offset: 20 });

        expect(mockFindMany).toHaveBeenCalledTimes(1);

        const calls = mockFindMany.mock.calls;
        // Verify we have calls and arguments before accessing index
        // This resolves: Object is possibly 'undefined' and Tuple type '[]' of length '0'
        if (calls.length > 0 && calls[0] && calls[0].length > 0) {
            const safeCalls = calls as any;
            const callArgs = safeCalls[0][0];
            expect(callArgs.limit).toBe(10);
            expect(callArgs.offset).toBe(20);
            expect(callArgs.where).toBeDefined();
        } else {
            // Fail the test if calls are missing (should be caught by toHaveBeenCalledTimes, but safe access is key)
            expect(calls.length).toBeGreaterThan(0);
        }
    });

    test("handles default/zero values correctly", async () => {
        await getHistoryShifts("org_1", { limit: 50, offset: 0 });

        expect(mockFindMany).toHaveBeenCalledTimes(1);

        const calls = mockFindMany.mock.calls;
        if (calls.length > 0 && calls[0] && calls[0].length > 0) {
            const safeCalls = calls as any;
            const callArgs = safeCalls[0][0];
            expect(callArgs.limit).toBe(50);
            expect(callArgs.offset).toBe(0);
        }
    });
});
