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
 * DEVELOPMENT PHASE: enforcement is OFF by default so the owner can test the
 * core product (Scheduler, shifts, timesheets) without the setup wizard in the
 * way. While it's off, /dashboard/onboarding redirects to Shifts; locations,
 * people and scheduling answers are set in Settings and the Team page instead.
 *
 * BEFORE LAUNCH: turn it back on, either by setting
 * PAVN_DISABLE_ONBOARDING_ENFORCEMENT=0 in production or by making the
 * fallback below `false` again. The e2e job sets it to 0, so the signup spec
 * still exercises the enforced flow.
 */
export function isOnboardingEnforcementDisabled() {
    const explicit = process.env.PAVN_DISABLE_ONBOARDING_ENFORCEMENT;

    if (explicit === "1" || explicit === "true") {
        return true;
    }

    if (explicit === "0" || explicit === "false") {
        return false;
    }

    // Development-phase default; see above before launch.
    return true;
}
