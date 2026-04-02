import { test, expect } from "@playwright/test";
import { db, desc, eq } from "@repo/database";
import { member, organization, user, verification } from "@repo/database/schema";

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

test.describe("manager browser signup flow", () => {
    test("landing page signup reaches onboarding for a fresh business", async ({ page }) => {
        test.setTimeout(120000);

        const runId = Date.now();
        const email = `browser-manager-${runId}@example.com`;
        const businessName = `Browser Flow Org ${runId}`;
        const password = "TestPassword123!";
        const browserConsole: string[] = [];
        const pageErrors: string[] = [];
        const requestFailures: string[] = [];

        page.on("console", (message) => {
            browserConsole.push(`${message.type()}: ${message.text()}`);
        });
        page.on("pageerror", (error) => {
            pageErrors.push(error.message);
        });
        page.on("requestfailed", (request) => {
            requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`);
        });

        await page.goto("/");

        await expect(page.getByRole("heading", { name: /stop paying the/i })).toBeVisible();
        await page.getByRole("link", { name: /get started free/i }).click();

        await expect(page).toHaveURL(/\/auth\/signup$/);

        await page.locator("#firstName").fill("Browser");
        await page.locator("#lastName").fill("Manager");
        await page.locator("#email").fill(email);
        await page.locator("#phone").fill("(617) 555-0199");
        await page.locator("#businessName").fill(businessName);
        await page.locator("#password").fill(password);

        const signUpResponsePromise = page.waitForResponse((response) =>
            response.request().method() === "POST" &&
            response.url().includes("/api/auth/sign-up/email")
        );
        await page.getByRole("button", { name: /create account/i }).click();
        const signUpResponse = await signUpResponsePromise;

        await test.info().attach("signup-response.txt", {
            body: await signUpResponse.text(),
            contentType: "text/plain",
        });

        try {
            await expect(page).toHaveURL(
                new RegExp(`/auth/verify-email\\?email=${encodeURIComponent(email)}`),
                { timeout: 15000 }
            );
        } catch (error) {
            await test.info().attach("browser-console.txt", {
                body: browserConsole.join("\n") || "no console messages",
                contentType: "text/plain",
            });
            await test.info().attach("page-errors.txt", {
                body: pageErrors.join("\n") || "no page errors",
                contentType: "text/plain",
            });
            await test.info().attach("request-failures.txt", {
                body: requestFailures.join("\n") || "no request failures",
                contentType: "text/plain",
            });
            throw error;
        }
        await expect(page.getByRole("heading", { name: /verify your email/i })).toBeVisible();

        const otp = await waitForEmailOtp(email);
        const otpInput = page.locator('input[data-input-otp="true"], input[autocomplete="one-time-code"], input').first();
        await otpInput.fill(otp);
        await page.getByRole("button", { name: /verify email/i }).click();

        await page.waitForURL(/\/dashboard\/onboarding/, { timeout: 30000 });
        await expect(page.getByRole("heading", { name: /let’s set up your business profile/i })).toBeVisible();
        await expect(page.getByText(new RegExp(businessName, "i")).first()).toBeVisible();
        await expect(page.getByText(/account ready/i).first()).toBeVisible();
        await expect(page.getByText(/business basics/i).first()).toBeVisible();
        await expect(page.getByText(/first location/i).first()).toBeVisible();
        await expect(page.getByText(/workforce access/i).first()).toBeVisible();
        await expect(page.getByText(/first published shift/i).first()).toBeVisible();
        await expect(page.locator("#onboarding_business_name")).toHaveValue(businessName);
        await expect(page.locator("#onboarding_timezone")).toBeVisible();
        await expect(page.getByText(/clock-in verification/i).first()).toBeVisible();
        await expect(page.getByRole("button", { name: /save and continue/i })).toBeVisible();
        await expect(page.getByText(/business basics/i).first()).toBeVisible();
        await expect(page.locator("#onboarding_location_name")).toHaveCount(0);
        await expect(page.getByText(/workspace created and admin access active/i)).toBeVisible();

        await page.getByRole("button", { name: /save and continue/i }).click();

        await expect(page.locator("#onboarding_location_name")).toBeVisible();
        await expect(page.locator("#onboarding_location_address")).toBeVisible();
        await expect(page.getByText(/add the first place where schedules are published and workers clock in/i)).toBeVisible();
        await page.locator("#onboarding_location_name").fill("Downtown Boston");
        await page.locator("#onboarding_location_address").fill("4 Yawkey Way, Boston, MA 02215");
        await page.getByRole("button", { name: /save location and continue/i }).click();

        await expect(page.getByRole("heading", { name: /add your first workers/i })).toBeVisible();
        await expect(page.getByText(/worker access is the gate for the mobile experience/i).first()).toBeVisible();
        await expect(page.getByRole("link", { name: /open roster workspace/i })).toBeVisible();
        await expect(page.getByRole("link", { name: /import roster csv/i })).toBeVisible();

        await page.context().clearCookies();
        await page.goto("/auth/login");
        await page.locator('input[name="email"]').fill(email);
        await page.locator('input[name="password"]').fill(password);
        await page.getByRole("button", { name: /sign in/i }).click();

        await page.waitForURL(/\/dashboard\/onboarding/, { timeout: 30000 });
        await expect(page.getByRole("heading", { name: /add your first workers/i })).toBeVisible();

        const createdUser = await db.query.user.findFirst({
            where: eq(user.email, email),
        });
        expect(createdUser).toBeDefined();
        expect(createdUser?.emailVerified).toBe(true);

        const orgMembership = await db.query.member.findFirst({
            where: eq(member.userId, createdUser!.id),
        });
        expect(orgMembership).toBeDefined();

        const createdOrg = await db.query.organization.findFirst({
            where: eq(organization.id, orgMembership!.organizationId),
        });
        expect(createdOrg?.name).toBe(businessName);
    });
});
