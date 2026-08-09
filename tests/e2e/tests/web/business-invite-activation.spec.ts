import { test, expect } from "@playwright/test";
import { db, desc, eq, and } from "@repo/database";
import { invitation, member, organization, user, verification } from "@repo/database/schema";

async function waitForEmailOtp(email: string): Promise<string> {
    const identifier = `email-verification-otp-${email}`;

    for (let attempt = 0; attempt < 20; attempt += 1) {
        const record = await db.query.verification.findFirst({
            where: eq(verification.identifier, identifier),
            orderBy: [desc(verification.createdAt)],
        });

        if (record?.value) {
            const otp = record.value.split(":")[0]?.trim();
            if (otp && /^\d{6}$/.test(otp)) {
                return otp;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    throw new Error(`Timed out waiting for email OTP for ${email}`);
}

async function createBusinessOwner(request: import("@playwright/test").APIRequestContext, runId: number) {
    const email = `owner-invite-${runId}@example.com`;
    const password = "TestPassword123!";
    const businessName = `Invite Flow Org ${runId}`;

    const signUpResponse = await request.post("/api/auth/sign-up/email", {
        data: {
            name: "Invite Owner",
            email,
            password,
            companyName: businessName,
        },
    });

    expect(signUpResponse.ok()).toBeTruthy();

    const createdUser = await db.query.user.findFirst({
        where: eq(user.email, email),
    });
    expect(createdUser).toBeDefined();

    const membership = await db.query.member.findFirst({
        where: eq(member.userId, createdUser!.id),
    });
    expect(membership).toBeDefined();

    return {
        email,
        password,
        businessName,
        ownerUserId: createdUser!.id,
        organizationId: membership!.organizationId,
    };
}

async function createStandaloneBusinessUser(request: import("@playwright/test").APIRequestContext, runId: number) {
    const email = `existing-manager-${runId}@example.com`;
    const password = "TestPassword123!";

    const signUpResponse = await request.post("/api/auth/sign-up/email", {
        data: {
            name: "Existing Manager",
            email,
            password,
        },
    });

    expect(signUpResponse.ok()).toBeTruthy();

    await db.update(user)
        .set({
            emailVerified: true,
            updatedAt: new Date(),
        })
        .where(eq(user.email, email));

    const createdUser = await db.query.user.findFirst({
        where: eq(user.email, email),
    });
    expect(createdUser).toBeDefined();

    return {
        email,
        password,
        userId: createdUser!.id,
    };
}

async function createPendingBusinessInvitation(params: {
    organizationId: string;
    inviterId: string;
    email: string;
    role: "admin" | "manager";
}) {
    const invitationId = crypto.randomUUID();

    await db.insert(invitation).values({
        id: invitationId,
        organizationId: params.organizationId,
        inviterId: params.inviterId,
        email: params.email,
        role: params.role,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
    });

    return invitationId;
}

test.describe("business invite activation", () => {
    test("new invited manager creates account, verifies email, and lands in shifts instead of onboarding", async ({ page, request }) => {
        test.setTimeout(120000);

        const runId = Date.now();
        const owner = await createBusinessOwner(request, runId);
        const invitedEmail = `new-manager-${runId}@example.com`;
        const invitationId = await createPendingBusinessInvitation({
            organizationId: owner.organizationId,
            inviterId: owner.ownerUserId,
            email: invitedEmail,
            role: "manager",
        });

        await page.goto(`/auth/activate?invitationId=${invitationId}`);

        await expect(page.getByRole("heading", { name: new RegExp(`join ${owner.businessName}`, "i") })).toBeVisible();
        await expect(page.getByRole("heading", { name: /create your access/i })).toBeVisible();

        await page.locator("#invite_first_name").fill("New");
        await page.locator("#invite_last_name").fill("Manager");
        await page.locator("#invite_password").fill("TestPassword123!");
        await page.getByRole("button", { name: /create account and continue/i }).click();

        await page.waitForURL(new RegExp(`/auth/verify-email\\?email=${encodeURIComponent(invitedEmail)}`), { timeout: 30000 });
        const otp = await waitForEmailOtp(invitedEmail);
        const otpInput = page.locator('input[data-input-otp="true"], input[autocomplete="one-time-code"], input').first();
        await otpInput.fill(otp);
        await page.getByRole("button", { name: /verify email/i }).click();

        await page.waitForURL(new RegExp(`/auth/activate\\?invitationId=${invitationId}`), { timeout: 30000 });
        await expect(page.getByRole("button", { name: /accept invitation/i })).toBeVisible();
        await page.getByRole("button", { name: /accept invitation/i }).click();

        await page.waitForURL(/\/dashboard\/shifts/, { timeout: 30000 });

        const invitedUser = await db.query.user.findFirst({
            where: eq(user.email, invitedEmail),
        });
        expect(invitedUser?.emailVerified).toBe(true);

        const invitedMembership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, invitedUser!.id),
                eq(member.organizationId, owner.organizationId),
            ),
        });
        expect(invitedMembership?.role).toBe("manager");

        const ownerOrganization = await db.query.organization.findFirst({
            where: eq(organization.id, owner.organizationId),
        });
        expect(ownerOrganization?.name).toBe(owner.businessName);
    });

    test("existing invited manager signs in, accepts invite, and skips admin onboarding", async ({ page, request }) => {
        test.setTimeout(120000);

        const runId = Date.now() + 1;
        const owner = await createBusinessOwner(request, runId);
        const existingUser = await createStandaloneBusinessUser(request, runId);
        const invitationId = await createPendingBusinessInvitation({
            organizationId: owner.organizationId,
            inviterId: owner.ownerUserId,
            email: existingUser.email,
            role: "manager",
        });

        await page.goto(`/auth/activate?invitationId=${invitationId}`);

        await expect(page.getByRole("heading", { name: /sign in to continue/i })).toBeVisible();
        await page.getByRole("link", { name: /sign in with invited email/i }).click();

        await page.waitForURL(/\/auth\/login/, { timeout: 15000 });
        await page.locator('input[name="email"]').fill(existingUser.email);
        await page.locator('input[name="password"]').fill(existingUser.password);
        await page.getByRole("button", { name: /sign in/i }).click();

        await page.waitForURL(new RegExp(`/auth/activate\\?invitationId=${invitationId}`), { timeout: 30000 });
        await expect(page.getByRole("button", { name: /accept invitation/i })).toBeVisible();
        await page.getByRole("button", { name: /accept invitation/i }).click();

        await page.waitForURL(/\/dashboard\/shifts/, { timeout: 30000 });

        const invitedMembership = await db.query.member.findFirst({
            where: and(
                eq(member.userId, existingUser.userId),
                eq(member.organizationId, owner.organizationId),
            ),
        });
        expect(invitedMembership?.role).toBe("manager");
    });
});
