import { test, expect, request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import { db, and, desc, eq, toLatLng } from "@repo/database";
import { invitation, location, member, rosterEntry, shift, shiftAssignment, user, workerRole } from "@repo/database/schema";
import { getWorkerPhoneAccess, syncWorkerMembershipsForPhone } from "../../../auth/src/worker-access";
import { normalizePhoneNumber } from "../../../auth/src/providers/sms";

async function createSignedInContext(
    baseURL: string,
    email: string,
    password: string
): Promise<APIRequestContext> {
    const context = await playwrightRequest.newContext({ baseURL });
    const response = await context.post("/api/auth/sign-in/email", {
        data: { email, password },
    });

    expect(response.ok()).toBeTruthy();
    return context;
}

async function createManagerAndOrg(apiBaseUrl: string, runId: number) {
    const managerEmail = `manager-lifecycle-${runId}@test.workershive.com`;
    const password = "TestPassword123!";
    const managerSignupContext = await playwrightRequest.newContext({ baseURL: apiBaseUrl });

    const managerSignUp = await managerSignupContext.post("/api/auth/sign-up/email", {
        data: {
            name: "Lifecycle Manager",
            email: managerEmail,
            password,
            companyName: `Lifecycle Org ${runId}`,
        },
    });
    expect(managerSignUp.ok()).toBeTruthy();

    const managerUser = await db.query.user.findFirst({
        where: eq(user.email, managerEmail),
    });
    expect(managerUser).toBeDefined();

    await db.update(user)
        .set({ emailVerified: true, updatedAt: new Date() })
        .where(eq(user.email, managerEmail));

    const managerMembership = await db.query.member.findFirst({
        where: eq(member.userId, managerUser!.id),
    });
    expect(managerMembership).toBeDefined();

    const managerContext = await createSignedInContext(apiBaseUrl, managerEmail, password);

    return {
        managerEmail,
        password,
        managerUser: managerUser!,
        orgId: managerMembership!.organizationId,
        managerSignupContext,
        managerContext,
    };
}

test.describe("manager/worker lifecycle", () => {
    test("registration to approved shift works across manager and worker roles", async ({ baseURL }) => {
        const apiBaseUrl = baseURL ?? process.env.API_URL ?? "http://localhost:4005";
        const runId = Date.now();
        const workerEmail = `worker-lifecycle-${runId}@test.workershive.com`;
        const { managerEmail, password, orgId, managerSignupContext, managerContext } = await createManagerAndOrg(apiBaseUrl, runId);
        const workerSignupContext = await playwrightRequest.newContext({ baseURL: apiBaseUrl });

        const locationId = `loc_lifecycle_${runId}`;
        await db.insert(location).values({
            id: locationId,
            organizationId: orgId,
            name: `Lifecycle Venue ${runId}`,
            slug: `lifecycle-venue-${runId}`,
            timezone: "UTC",
            address: "123 Test St, New York, NY",
            position: toLatLng(40.7128, -74.006),
            geofenceRadius: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const inviteResponse = await managerContext.post("/organizations/crew/invite", {
            headers: { "x-org-id": orgId },
            data: {
                email: workerEmail,
                role: "member",
            },
        });
        expect(inviteResponse.ok()).toBeTruthy();

        const inviteRecord = await db.query.invitation.findFirst({
            where: and(
                eq(invitation.email, workerEmail),
                eq(invitation.organizationId, orgId)
            ),
            orderBy: [desc(invitation.createdAt)],
        });
        expect(inviteRecord).toBeDefined();

        const workerSignUp = await workerSignupContext.post("/api/auth/sign-up/email", {
            data: {
                name: "Lifecycle Worker",
                email: workerEmail,
                password,
                role: "worker",
                orgId,
                inviteToken: inviteRecord!.id,
            },
        });
        expect(workerSignUp.ok()).toBeTruthy();

        await db.update(user)
            .set({ emailVerified: true, updatedAt: new Date() })
            .where(eq(user.email, workerEmail));

        const workerUser = await db.query.user.findFirst({
            where: eq(user.email, workerEmail),
        });
        expect(workerUser).toBeDefined();

        const workerMembership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, workerUser!.id),
                eq(member.organizationId, orgId)
            ),
        });
        expect(workerMembership).toBeDefined();

        const workerContext = await createSignedInContext(apiBaseUrl, workerEmail, password);

        const shiftStart = new Date(Date.now() - 5 * 60 * 1000);
        const shiftEnd = new Date(Date.now() + 55 * 60 * 1000);
        const shiftDate = shiftStart.toISOString().slice(0, 10);
        const startTime = shiftStart.toISOString().slice(11, 16);
        const endTime = shiftEnd.toISOString().slice(11, 16);
        const shiftTitle = `Lifecycle Shift ${runId}`;

        const publishResponse = await managerContext.post("/shifts/publish", {
            headers: { "x-org-id": orgId },
            data: {
                organizationId: orgId,
                locationId,
                timezone: "UTC",
                status: "published",
                schedules: [
                    {
                        scheduleName: shiftTitle,
                        dates: [shiftDate],
                        startTime,
                        endTime,
                        positions: [
                            {
                                roleName: shiftTitle,
                                workerIds: [workerUser!.id],
                            },
                        ],
                    },
                ],
            },
        });
        expect(publishResponse.ok()).toBeTruthy();

        const createdShift = await db.query.shift.findFirst({
            where: and(
                eq(shift.organizationId, orgId),
                eq(shift.title, shiftTitle)
            ),
            orderBy: [desc(shift.createdAt)],
        });
        expect(createdShift).toBeDefined();

        const createdAssignment = await db.query.shiftAssignment.findFirst({
            where: and(
                eq(shiftAssignment.shiftId, createdShift!.id),
                eq(shiftAssignment.workerId, workerUser!.id)
            ),
        });
        expect(createdAssignment).toBeDefined();

        const workerUpcoming = await workerContext.get("/worker/shifts?status=upcoming", {
            headers: { "x-org-id": orgId },
        });
        expect(workerUpcoming.ok()).toBeTruthy();
        const workerUpcomingData = await workerUpcoming.json() as { shifts: Array<{ id: string }> };
        expect(workerUpcomingData.shifts.some((workerShift) => workerShift.id === createdShift!.id)).toBe(true);

        const clockInResponse = await workerContext.post("/geofence/clock-in", {
            headers: { "x-org-id": orgId },
            data: {
                shiftId: createdShift!.id,
                latitude: 40.7128,
                longitude: -74.006,
                accuracyMeters: 10,
                deviceTimestamp: new Date().toISOString(),
            },
        });
        expect(clockInResponse.ok()).toBeTruthy();

        const afterClockIn = await db.query.shiftAssignment.findFirst({
            where: eq(shiftAssignment.id, createdAssignment!.id),
        });
        expect(afterClockIn?.actualClockIn).toBeTruthy();

        const clockOutResponse = await workerContext.post("/geofence/clock-out", {
            headers: { "x-org-id": orgId },
            data: {
                shiftId: createdShift!.id,
                latitude: 40.7128,
                longitude: -74.006,
                accuracyMeters: 10,
                deviceTimestamp: new Date().toISOString(),
            },
        });
        expect(clockOutResponse.ok()).toBeTruthy();

        const overrideResponse = await managerContext.post("/geofence/manager-override", {
            headers: { "x-org-id": orgId },
            data: {
                shiftAssignmentId: createdAssignment!.id,
                clockIn: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
                clockOut: new Date().toISOString(),
                breakMinutes: 0,
                notes: "E2E lifecycle normalization",
            },
        });
        expect(overrideResponse.ok()).toBeTruthy();

        const managerTimesheets = await managerContext.get(`/shifts/${createdShift!.id}/timesheets`, {
            headers: { "x-org-id": orgId },
        });
        expect(managerTimesheets.ok()).toBeTruthy();
        const managerTimesheetData = await managerTimesheets.json() as Array<{ clockIn?: string; clockOut?: string }>;
        expect(managerTimesheetData).toHaveLength(1);
        expect(managerTimesheetData[0]?.clockIn).toBeTruthy();
        expect(managerTimesheetData[0]?.clockOut).toBeTruthy();

        const approveResponse = await managerContext.post(`/shifts/${createdShift!.id}/approve`, {
            headers: { "x-org-id": orgId },
        });
        expect(approveResponse.ok()).toBeTruthy();

        const approvedShift = await db.query.shift.findFirst({
            where: eq(shift.id, createdShift!.id),
        });
        expect(approvedShift?.status).toBe("approved");

        const workerHistory = await workerContext.get("/worker/shifts?status=history", {
            headers: { "x-org-id": orgId },
        });
        expect(workerHistory.ok()).toBeTruthy();
        const workerHistoryData = await workerHistory.json() as { shifts: Array<{ id: string; status: string }> };
        const historyShift = workerHistoryData.shifts.find((workerShift) => workerShift.id === createdShift!.id);
        expect(historyShift?.status).toBe("approved");

        await managerSignupContext.dispose();
        await workerSignupContext.dispose();
        await managerContext.dispose();
        await workerContext.dispose();
    });

    test("phone activation syncs invited roles and custom-role scheduling supports open slots", async ({ baseURL }) => {
        const apiBaseUrl = baseURL ?? process.env.API_URL ?? "http://localhost:4005";
        const runId = Date.now() + 1;
        const { orgId, managerContext, managerSignupContext } = await createManagerAndOrg(apiBaseUrl, runId);
        const locationId = `loc_role_lifecycle_${runId}`;
        const phoneNumber = "+14155552671";
        const normalizedPhone = normalizePhoneNumber(phoneNumber);
        const workerUserId = crypto.randomUUID();

        await db.insert(location).values({
            id: locationId,
            organizationId: orgId,
            name: `Role Lifecycle Venue ${runId}`,
            slug: `role-lifecycle-venue-${runId}`,
            timezone: "UTC",
            address: "456 Test Ave, New York, NY",
            position: toLatLng(40.7128, -74.006),
            geofenceRadius: 100,
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        await db.insert(rosterEntry).values({
            id: `re_${runId}`,
            organizationId: orgId,
            name: "Phone Worker",
            email: `worker-phone-${runId}@test.workershive.com`,
            phoneNumber: normalizedPhone,
            role: "member",
            jobTitle: "Shift Lead",
            roles: ["Cashier", "Shift Lead", "Cashier"],
            hourlyRate: 2400,
            status: "invited",
            createdAt: new Date(),
        });

        const access = await getWorkerPhoneAccess(phoneNumber);
        expect(access.eligible).toBe(true);
        expect(access.organizationIds).toContain(orgId);
        expect(access.rosterAccess[0]?.roles).toEqual(["Cashier", "Shift Lead", "Cashier"]);

        await db.insert(user).values({
            id: workerUserId,
            name: normalizedPhone,
            email: `worker-sync-${runId}@workershive.local`,
            emailVerified: true,
            phoneNumber: normalizedPhone,
            role: "worker",
            createdAt: new Date(),
            updatedAt: new Date(),
        });

        const syncedOrganizationIds = await syncWorkerMembershipsForPhone(workerUserId, phoneNumber);
        expect(syncedOrganizationIds).toContain(orgId);

        const workerMembership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, workerUserId),
                eq(member.organizationId, orgId),
            ),
        });
        expect(workerMembership).toBeDefined();
        expect(workerMembership?.jobTitle).toBe("Shift Lead");
        expect(workerMembership?.hourlyRate).toBe(2400);

        const syncedRoles = await db.query.workerRole.findMany({
            where: and(
                eq(workerRole.workerId, workerUserId),
                eq(workerRole.organizationId, orgId),
            ),
            orderBy: [workerRole.role],
        });
        expect(syncedRoles.map((role) => role.role)).toEqual(["Cashier", "Shift Lead"]);

        const syncedRoster = await db.query.rosterEntry.findFirst({
            where: eq(rosterEntry.id, `re_${runId}`),
        });
        expect(syncedRoster?.status).toBe("active");

        const publishResponse = await managerContext.post("/shifts/publish", {
            headers: { "x-org-id": orgId },
            data: {
                organizationId: orgId,
                locationId,
                timezone: "UTC",
                status: "published",
                schedules: [
                    {
                        scheduleName: `Custom Role Shift ${runId}`,
                        dates: [new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)],
                        startTime: "09:00",
                        endTime: "17:00",
                        positions: [
                            {
                                roleName: "Forklift Operator",
                                workerIds: [workerUserId, null],
                            },
                        ],
                    },
                ],
            },
        });
        expect(publishResponse.ok()).toBeTruthy();

        const publishedShift = await db.query.shift.findFirst({
            where: and(
                eq(shift.organizationId, orgId),
                eq(shift.title, "Forklift Operator"),
            ),
            orderBy: [desc(shift.createdAt)],
        });
        expect(publishedShift).toBeDefined();
        expect(publishedShift?.capacityTotal).toBe(2);
        expect(publishedShift?.status).toBe("published");

        const assignments = await db.query.shiftAssignment.findMany({
            where: eq(shiftAssignment.shiftId, publishedShift!.id),
        });
        expect(assignments).toHaveLength(1);
        expect(assignments[0]?.workerId).toBe(workerUserId);

        await managerSignupContext.dispose();
        await managerContext.dispose();
    });
});
