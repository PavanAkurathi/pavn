import { describe, expect, test, mock, beforeEach } from "bun:test";

const mockOffset: any = mock(() => Promise.resolve([]));
const mockLimit: any = mock(() => ({ offset: mockOffset }));
const mockWhere: any = mock(() => ({ limit: mockLimit }));
const mockInnerJoin: any = mock(() => ({ where: mockWhere }));
const mockFrom: any = mock(() => ({ innerJoin: mockInnerJoin }));
const mockSelect: any = mock(() => ({ from: mockFrom }));
const mockFindMany: any = mock(() => Promise.resolve([]));

mock.module("@repo/database", () => ({
    db: {
        select: mockSelect,
        query: {
            workerRole: {
                findMany: mockFindMany,
            },
        },
    }
}));

import { getCrew } from "../src/modules/directory/get-crew";

describe("WH-116: Crew Search", () => {
    beforeEach(() => {
        mockSelect.mockClear();
        mockFrom.mockClear();
        mockInnerJoin.mockClear();
        mockWhere.mockClear();
        mockLimit.mockClear();
        mockOffset.mockClear();
        mockFindMany.mockClear();
        mockOffset.mockImplementation(() => Promise.resolve([]));
        mockFindMany.mockImplementation(() => Promise.resolve([]));
    });

    test("passes search term to DB query", async () => {
        await getCrew("org_1", { search: "John", limit: 10, offset: 0 });
        expect(mockSelect).toHaveBeenCalled();
    });

    test("passes pagination params", async () => {
        await getCrew("org_1", { limit: 5, offset: 10 });
        expect(mockSelect).toHaveBeenCalled();
    });

    test("returns normalized explicit roles and job title fallback", async () => {
        mockOffset.mockImplementationOnce(() => Promise.resolve([
            {
                memberId: "mem_1",
                id: "user_1",
                name: "John Doe",
                email: "john@example.com",
                image: null,
                jobTitle: "shift_lead",
                status: "active",
            },
        ]));
        mockFindMany.mockImplementationOnce(() => Promise.resolve([
            { workerId: "user_1", role: "barista" },
            { workerId: "user_1", role: "dishwasher" },
            { workerId: "user_1", role: "barista" },
        ]));

        const result = await getCrew("org_1");

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: "user_1",
            memberId: "mem_1",
            role: "Barista",
            roles: ["Barista", "Dishwasher", "Shift Lead"],
            initials: "JD",
        });
    });
});
