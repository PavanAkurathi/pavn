
import { describe, expect, test } from "bun:test";
import { validateShiftTransition, VALID_TRANSITIONS } from "../src/shift-state";

describe("Shift State Machine", () => {
    test("allows valid transitions", () => {
        expect(() => validateShiftTransition('draft', 'published')).not.toThrow();
        expect(() => validateShiftTransition('published', 'assigned')).not.toThrow();
        expect(() => validateShiftTransition('assigned', 'in-progress')).not.toThrow();
        expect(() => validateShiftTransition('in-progress', 'completed')).not.toThrow();
        expect(() => validateShiftTransition('completed', 'approved')).not.toThrow();
    });

    test("allows correction loops", () => {
        // Un-approve
        expect(() => validateShiftTransition('approved', 'completed')).not.toThrow();
        // Re-open
        expect(() => validateShiftTransition('completed', 'in-progress')).not.toThrow();
    });

    test("blocks invalid transitions", () => {
        expect(() => validateShiftTransition('draft', 'approved')).toThrow("Invalid shift status transition");
        expect(() => validateShiftTransition('draft', 'completed')).toThrow();
        expect(() => validateShiftTransition('published', 'approved')).toThrow();
        expect(() => validateShiftTransition('cancelled', 'approved')).toThrow();
    });

    test("validates all defined states exist in map", () => {
        const states = Object.keys(VALID_TRANSITIONS);
        for (const state of states) {
            expect(VALID_TRANSITIONS[state as keyof typeof VALID_TRANSITIONS]).toBeDefined();
        }
    });
});
