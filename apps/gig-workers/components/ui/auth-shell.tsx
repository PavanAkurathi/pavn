import type { ReactNode } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    View,
} from "react-native";

import { Card } from "heroui-native/card";

import { Screen } from "./screen";

type AuthShellProps = {
    icon: ReactNode;
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    footer?: ReactNode;
};

export function AuthShell({
    icon,
    eyebrow,
    title,
    description,
    children,
    footer,
}: AuthShellProps) {
    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{ flex: 1 }}
        >
            <Screen>
                <ScrollView
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{
                        flexGrow: 1,
                        justifyContent: "center",
                        paddingHorizontal: 20,
                        paddingVertical: 32,
                    }}
                >
                    <View className="mx-auto w-full max-w-md gap-6">
                        <View className="items-center gap-4 px-3">
                            <View className="h-18 w-18 items-center justify-center rounded-[28px] bg-default">
                                {icon}
                            </View>
                            <View className="items-center gap-2">
                                <Text className="text-xs font-semibold uppercase tracking-[2.4px] text-muted">
                                    {eyebrow}
                                </Text>
                                <Text className="text-center text-[30px] font-semibold leading-9 text-foreground">
                                    {title}
                                </Text>
                                <Text className="max-w-sm text-center text-base leading-6 text-muted">
                                    {description}
                                </Text>
                            </View>
                        </View>

                        <Card className="rounded-[32px]">
                            <Card.Body className="gap-5 p-6">{children}</Card.Body>
                        </Card>

                        {footer ? <View className="px-3">{footer}</View> : null}
                    </View>
                </ScrollView>
            </Screen>
        </KeyboardAvoidingView>
    );
}
