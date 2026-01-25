import { expect, test, describe } from "bun:test";
import { calculateShiftPay } from "../src/utils/calculations";

describe("calculateShiftPay", () => {
    test("calculates pay for exact hours", () => {
        // 10 hours * $20/hr = $200
        const pay = calculateShiftPay(600, 2000);
        expect(pay).toBe(20000);
    });

    test("calculates pay for partial hours (rounding up preference)", () => {
        // 1.5 hours (90 mins) * $10/hr = $15
        const pay = calculateShiftPay(90, 1000);
        expect(pay).toBe(1500);
    });

    test("handles partial cents correctly (ceil)", () => {
        // 1 minute at $20/hr ($2000 cents) = 2000/60 = 33.33 cents -> 34 cents
        const pay = calculateShiftPay(1, 2000);
        expect(pay).toBe(34);
    });

    test("returns 0 for zero or negative time", () => {
        expect(calculateShiftPay(0, 2000)).toBe(0);
        expect(calculateShiftPay(-10, 2000)).toBe(0);
    });

    test("returns 0 for zero rate", () => {
        expect(calculateShiftPay(60, 0)).toBe(0);
    });
});
