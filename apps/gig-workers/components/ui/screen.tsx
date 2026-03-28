import type { ReactNode } from "react";
import { View } from "react-native";

type ScreenProps = {
    children: ReactNode;
    className?: string;
};

export function Screen({ children, className }: ScreenProps) {
    return <View className={["flex-1 bg-background", className].filter(Boolean).join(" ")}>{children}</View>;
}
