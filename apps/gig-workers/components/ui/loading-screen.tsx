import { Text, View } from "react-native";

import { Spinner } from "heroui-native/spinner";

import { Screen } from "./screen";

type LoadingScreenProps = {
    label?: string;
};

export function LoadingScreen({ label = "Loading" }: LoadingScreenProps) {
    return (
        <Screen className="items-center justify-center gap-4 px-6">
            <Spinner size="lg" />
            <Text className="text-sm text-muted">{label}</Text>
        </Screen>
    );
}
