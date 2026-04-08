import { describe, expect, test } from "bun:test";
import { mapShiftToDto } from "../src/utils/mapper";

describe("mapShiftToDto", () => {
    test("excludes removed assignments from assigned workers and filled capacity", () => {
        const dto = mapShiftToDto({
            id: "shift_1",
            title: "Host Stand",
            description: null,
            locationId: "loc_1",
            contactId: null,
            startTime: new Date("2026-04-08T16:00:00.000Z"),
            endTime: new Date("2026-04-08T23:00:00.000Z"),
            status: "assigned",
            capacityTotal: 3,
            location: {
                id: "loc_1",
                name: "Downtown Bistro",
                address: "123 Main St",
                geofenceRadius: 150,
            },
            organization: {
                id: "org_1",
                attendanceVerificationPolicy: "strict_geofence",
            },
            assignments: [
                {
                    id: "asg_live",
                    workerId: "worker_live",
                    status: "active",
                    worker: { id: "worker_live", name: "Lena Brooks", image: null },
                },
                {
                    id: "asg_removed",
                    workerId: "worker_removed",
                    status: "removed",
                    worker: { id: "worker_removed", name: "Removed Worker", image: null },
                },
            ],
        } as any);

        expect(dto.capacity?.filled).toBe(1);
        expect(dto.assignedWorkers).toHaveLength(1);
        expect(dto.assignedWorkers?.[0]?.id).toBe("worker_live");
    });
});
