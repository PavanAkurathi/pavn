import { describe, expect, test } from "bun:test";
import { formatTimeRange, parseTimeRange } from "./parse-time-range";

const range = (input: string) => {
    const r = parseTimeRange(input);
    return r ? `${r.startLocal}-${r.endLocal}${r.overnight ? "+1" : ""}` : null;
};

describe("parseTimeRange", () => {
    test("reads the way managers type", () => {
        expect(range("9-5")).toBe("09:00-17:00");
        expect(range("9a-5:30p")).toBe("09:00-17:30");
        expect(range("17-23")).toBe("17:00-23:00");
        expect(range("10-2")).toBe("10:00-14:00");
        expect(range("11:30am - 7pm")).toBe("11:30-19:00");
        expect(range("0930-1500")).toBe("09:30-15:00");
        expect(range("4p to 11p")).toBe("16:00-23:00");
        expect(range("12-8")).toBe("12:00-20:00");
    });

    test("afternoon starts and overnight ends need no suffix", () => {
        expect(range("5-1")).toBe("17:00-01:00+1");
        expect(range("4-11")).toBe("16:00-23:00");
        expect(range("6p-2a")).toBe("18:00-02:00+1");
        expect(range("22-6")).toBe("22:00-06:00+1");
    });

    test("a suffix on the end settles a bare start", () => {
        expect(range("11-7p")).toBe("11:00-19:00");
        expect(range("5-11p")).toBe("17:00-23:00");
        expect(range("6a-2p")).toBe("06:00-14:00");
    });

    test("nonsense and marathons are refused", () => {
        for (const bad of ["", "9", "9-", "abc", "25-3", "9:75-5", "9a-9a", "6a-11p", "1-2-3"]) {
            expect(range(bad)).toBeNull();
        }
    });

    test("formats back to the typed style", () => {
        expect(formatTimeRange("09:00", "17:30")).toBe("9a-5:30p");
        expect(formatTimeRange("00:00", "12:00")).toBe("12a-12p");
    });
});
