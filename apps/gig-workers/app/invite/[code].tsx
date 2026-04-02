import { Stack, useLocalSearchParams } from "expo-router";

import { WorkerPhoneAuthFlow } from "../../components/auth/worker-phone-auth-flow";

function getInviteCode(value: string | string[] | undefined): string | null {
    if (Array.isArray(value)) {
        return value[0] ?? null;
    }

    return value ?? null;
}

export default function InviteRedemptionScreen() {
    const params = useLocalSearchParams<{ code?: string | string[] }>();

    return (
        <>
            <Stack.Screen options={{ title: "Worker invite", headerBackTitle: "Back" }} />
            <WorkerPhoneAuthFlow
                mode="invite"
                inviteCode={getInviteCode(params.code)}
            />
        </>
    );
}
