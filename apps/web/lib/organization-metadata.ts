export type OrganizationOnboardingMetadata = {
    description?: string;
    onboarding?: {
        businessInformationCompleted?: boolean;
        billingPromptHandled?: boolean;
    };
    [key: string]: unknown;
};

export function parseOrganizationMetadata(raw: string | null | undefined): OrganizationOnboardingMetadata {
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") {
            return { description: parsed };
        }
        if (parsed && typeof parsed === "object") {
            return parsed as OrganizationOnboardingMetadata;
        }
    } catch {
        return { description: raw };
    }

    return {};
}

export function getOrganizationDescription(raw: string | null | undefined) {
    return parseOrganizationMetadata(raw).description ?? "";
}

export function serializeOrganizationMetadata(metadata: OrganizationOnboardingMetadata) {
    const next: OrganizationOnboardingMetadata = {};

    if (metadata.description) {
        next.description = metadata.description;
    }

    if (
        metadata.onboarding?.businessInformationCompleted ||
        metadata.onboarding?.billingPromptHandled
    ) {
        next.onboarding = {
            ...(metadata.onboarding?.businessInformationCompleted
                ? { businessInformationCompleted: true }
                : {}),
            ...(metadata.onboarding?.billingPromptHandled
                ? { billingPromptHandled: true }
                : {}),
        };
    }

    return JSON.stringify(next);
}
