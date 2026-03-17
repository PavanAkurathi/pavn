import { Redirect, useLocalSearchParams } from "expo-router";

export default function PastShiftDetailRedirect() {
    const { id } = useLocalSearchParams<{ id?: string }>();

    if (!id) {
        return <Redirect href="/(tabs)" />;
    }

    return <Redirect href={`/shift/${id}` as any} />;
}
