import { describe, test, expect, mock, beforeEach } from "bun:test";

let existingLocation: Record<string, unknown> | undefined;
let updatedValues: Record<string, unknown> = {};

const mockDb = {
    query: {
        location: {
            findFirst: mock(() => Promise.resolve(existingLocation)),
        },
    },
    update: () => ({
        set: (values: Record<string, unknown>) => {
            updatedValues = values;
            return {
                where: () => ({ returning: () => Promise.resolve([{ id: "loc_1", ...values }]) }),
            };
        },
    }),
};

mock.module("@repo/database", () => ({
    db: mockDb,
    toLatLng: (lat: number, lng: number) => `POINT(${lng} ${lat})`,
}));

// Phoenix — the interesting case, because Arizona does not observe DST.
const PHOENIX = { latitude: "33.4484", longitude: "-112.0740" };
let geocodeSucceeds = true;

mock.module("../src/modules/locations/geocoding", () => ({
    geocodeAddress: mock(async () =>
        geocodeSucceeds
            ? {
                success: true,
                data: { ...PHOENIX, formattedAddress: "1 E Washington St, Phoenix, AZ", source: "test", confidence: "high" },
            }
            : { success: false },
    ),
}));

const { updateLocation } = await import("../src/modules/locations/update-location");

describe("updateLocation", () => {
    beforeEach(() => {
        updatedValues = {};
        geocodeSucceeds = true;
        existingLocation = {
            id: "loc_1",
            organizationId: "org_1",
            address: "1 Congress St, Boston, MA",
            timezone: "America/New_York",
        };
    });

    test("moving a location to another timezone moves its clock too", async () => {
        await updateLocation(
            { address: "1 E Washington St, Phoenix, AZ" },
            "loc_1",
            "org_1",
        );

        expect(updatedValues.timezone).toBe("America/Phoenix");
    });

    test("a submitted timezone does not override where the address actually is", async () => {
        await updateLocation(
            { address: "1 E Washington St, Phoenix, AZ", timezone: "Europe/London" },
            "loc_1",
            "org_1",
        );

        expect(updatedValues.timezone).toBe("America/Phoenix");
    });

    test("leaves the timezone alone when the address has not changed", async () => {
        await updateLocation({ name: "Renamed Yard" }, "loc_1", "org_1");

        expect(updatedValues.timezone).toBeUndefined();
        expect(updatedValues.name).toBe("Renamed Yard");
    });

    test("keeps the old timezone when the new address cannot be placed", async () => {
        geocodeSucceeds = false;

        await updateLocation({ address: "somewhere unplaceable" }, "loc_1", "org_1");

        expect(updatedValues.timezone).toBeUndefined();
    });
});
