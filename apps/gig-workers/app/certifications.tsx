import { Linking } from "react-native";
import { useRouter } from "expo-router";

import { EmptyState } from "../components/ui/empty-state";
import { PageHeader } from "../components/ui/page-header";
import { Screen } from "../components/ui/screen";

export default function CertificationsScreen() {
    const router = useRouter();

    return (
        <Screen>
            <PageHeader title="Certifications" showBack onBack={() => router.back()} />

            <Screen className="px-5 pt-6">
                <EmptyState
                    icon="ribbon-outline"
                    title="Not available in this build"
                    description="Certification upload and tracking are not part of the current launch scope for the worker app."
                    actionLabel="Contact support"
                    onAction={() => Linking.openURL("mailto:support@workershive.com")}
                />
            </Screen>
        </Screen>
    );
}
