import { describe, expect, it } from "bun:test";
import { validateShiftTransition } from "@repo/config";

describe("Shift State Machine", () => {
    it("allows valid normal flow", () => {
        expect(() => validateShiftTransition('published', 'assigned')).not.toThrow();
        expect(() => validateShiftTransition('assigned', 'in-progress')).not.toThrow();
        expect(() => validateShiftTransition('in-progress', 'completed')).not.toThrow();
        expect(() => validateShiftTransition('completed', 'approved')).not.toThrow();
    });

    it("allows cancellation from almost anywhere", () => {
        expect(() => validateShiftTransition('published', 'cancelled')).not.toThrow();
        expect(() => validateShiftTransition('assigned', 'cancelled')).not.toThrow();
        expect(() => validateShiftTransition('in-progress', 'cancelled')).not.toThrow();
    });

    it("prevents skipping steps", () => {
        // Runtime allows some operational shortcuts because staffing state and
        // shift state are not always kept perfectly in lockstep.
        expect(() => validateShiftTransition('draft', 'completed')).toThrow();
        expect(() => validateShiftTransition('published', 'approved')).toThrow();
        expect(() => validateShiftTransition('assigned', 'draft')).toThrow();
    });

    it("prevents back-flow", () => {
        expect(() => validateShiftTransition('completed', 'assigned')).toThrow();
        expect(() => validateShiftTransition('approved', 'in-progress')).toThrow();
    });
});
