/**
 * Whether to skip pushing an admin with an incomplete business through the
 * onboarding wizard.
 *
 * This used to default to `NODE_ENV !== "production"`, which switched
 * enforcement off in dev, test, preview and staging — every environment except
 * the one nobody can safely experiment in. The effect was that the first thing
 * a new customer ever sees was the only flow that could not be exercised
 * locally or in a preview deploy.
 *
 * It also quietly broke a test: `signup-auth-flow.spec.ts` asserts that a fresh
 * business signup lands on /dashboard/onboarding, and the Playwright job sets no
 * override, so under the old default that spec could never pass. It went
 * unnoticed because the e2e job is opt-in behind `vars.RUN_E2E`.
 *
 * Enforcement is now on everywhere by default. Set
 * PAVN_DISABLE_ONBOARDING_ENFORCEMENT=1 to opt a specific environment out — for
 * seeded fixtures or a demo account that should land straight on the dashboard.
 */
export function isOnboardingEnforcementDisabled() {
    const explicit = process.env.PAVN_DISABLE_ONBOARDING_ENFORCEMENT;

    if (explicit === "1" || explicit === "true") {
        return true;
    }

    if (explicit === "0" || explicit === "false") {
        return false;
    }

    return false;
}
