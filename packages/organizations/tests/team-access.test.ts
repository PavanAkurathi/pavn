import { describe, expect, test } from "bun:test";
import { buildTeamAccessList, isOpenWorkerInvitation } from "../src/modules/workspace/team-access";

const at = (day: number) => new Date(`2026-10-0${day}T12:00:00Z`);

describe("buildTeamAccessList", () => {
    test("keeps owners, admins and managers, members and invitations alike", () => {
        const list = buildTeamAccessList([
            { id: "o", role: "owner", joinedAt: at(1) },
            { id: "a", role: "admin", joinedAt: at(2) },
            { id: "m", role: "manager", joinedAt: at(3) },
        ]);

        expect(list.map((entry) => entry.id)).toEqual(["m", "a", "o"]);
    });

    test("drops workers, whether active or only invited", () => {
        const list = buildTeamAccessList([
            { id: "worker", role: "member", joinedAt: at(4) },
            { id: "pending-worker", role: "member", joinedAt: at(5) },
            { id: "boss", role: "admin", joinedAt: at(1) },
        ]);

        expect(list.map((entry) => entry.id)).toEqual(["boss"]);
    });

    test("an unknown role is not access", () => {
        expect(buildTeamAccessList([{ id: "x", role: "", joinedAt: at(1) }])).toEqual([]);
    });
});

describe("isOpenWorkerInvitation", () => {
    test("a pending worker invitation is on the roster", () => {
        expect(isOpenWorkerInvitation({ role: "member", status: "pending" })).toBe(true);
    });

    test("a manager's or admin's invitation is not a worker", () => {
        expect(isOpenWorkerInvitation({ role: "manager", status: "pending" })).toBe(false);
        expect(isOpenWorkerInvitation({ role: "admin", status: "pending" })).toBe(false);
    });

    test("an invitation that is no longer open is not waiting to start", () => {
        expect(isOpenWorkerInvitation({ role: "member", status: "accepted" })).toBe(false);
        expect(isOpenWorkerInvitation({ role: "member", status: "canceled" })).toBe(false);
        expect(isOpenWorkerInvitation({ role: "member", status: null })).toBe(false);
    });
});
