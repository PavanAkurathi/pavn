export function isOnboardingEnforcementDisabled() {
    const explicit = process.env.PAVN_DISABLE_ONBOARDING_ENFORCEMENT;

    if (explicit === "1" || explicit === "true") {
        return true;
    }

    if (explicit === "0" || explicit === "false") {
        return false;
    }

    return process.env.NODE_ENV !== "production";
}
