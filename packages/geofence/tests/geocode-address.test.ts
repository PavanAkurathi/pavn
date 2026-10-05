import { describe, expect, test } from "bun:test";
import { compactNominatimAddress } from "../src/utils/geocode";

const LONG =
    "Empire State Building, 350, 5th Avenue, Koreatown, Manhattan Community Board 5, Manhattan, New York County, New York, 10118, United States";

describe("compactNominatimAddress", () => {
    test("builds the short form people write", () => {
        expect(
            compactNominatimAddress({
                display_name: LONG,
                address: {
                    tourism: "Empire State Building",
                    house_number: "350",
                    road: "5th Avenue",
                    neighbourhood: "Koreatown",
                    suburb: "Manhattan",
                    city: "New York",
                    state: "New York",
                    "ISO3166-2-lvl4": "US-NY",
                    postcode: "10118",
                },
            }),
        ).toBe("350 5th Avenue, New York, NY 10118");
    });

    test("falls back to a smaller place when there is no city", () => {
        expect(
            compactNominatimAddress({
                display_name: "x",
                address: { house_number: "12", road: "High Street", town: "Bath", postcode: "BA1 1AA" },
            }),
        ).toBe("12 High Street, Bath, BA1 1AA");
    });

    test("keeps the long form when the street or place is missing", () => {
        expect(compactNominatimAddress({ display_name: LONG, address: { city: "New York" } })).toBe(LONG);
        expect(compactNominatimAddress({ display_name: LONG })).toBe(LONG);
    });
});
