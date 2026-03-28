import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Icon } from "./icon";

type HeaderAction = {
    icon: string;
    onPress: () => void;
    label?: string;
};

type PageHeaderProps = {
    title: string;
    subtitle?: string;
    showBack?: boolean;
    onBack?: () => void;
    right?: ReactNode;
    actions?: HeaderAction[];
};

export function PageHeader({
    title,
    subtitle,
    showBack = false,
    onBack,
    right,
    actions,
}: PageHeaderProps) {
    const router = useRouter();

    return (
        <SafeAreaView edges={["top"]} className="bg-background">
            <View className="flex-row items-start justify-between px-5 pb-3 pt-2">
                <View className="flex-1 flex-row items-start gap-3">
                    {showBack ? (
                        <Pressable
                            onPress={onBack || (() => router.back())}
                            className="mt-0.5 h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
                        >
                            <Icon name="arrow-back" size={20} className="text-foreground" />
                        </Pressable>
                    ) : null}

                    <View className="flex-1 gap-1">
                        <Text className="text-[30px] font-semibold leading-9 text-foreground">
                            {title}
                        </Text>
                        {subtitle ? (
                            <Text className="text-sm leading-5 text-muted">{subtitle}</Text>
                        ) : null}
                    </View>
                </View>

                {actions?.length ? (
                    <View className="ml-4 flex-row items-center gap-2">
                        {actions.map((action, index) => (
                            <Pressable
                                key={`${action.icon}-${index}`}
                                onPress={action.onPress}
                                accessibilityLabel={action.label}
                                className="h-10 w-10 items-center justify-center rounded-full border border-border bg-surface"
                            >
                                <Icon name={action.icon as any} size={20} className="text-foreground" />
                            </Pressable>
                        ))}
                    </View>
                ) : right ? (
                    <View className="ml-4">{right}</View>
                ) : null}
            </View>
        </SafeAreaView>
    );
}
