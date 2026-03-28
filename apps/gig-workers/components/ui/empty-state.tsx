import type { ReactNode } from "react";
import { Text, View } from "react-native";

import { Button } from "heroui-native/button";
import { Card } from "heroui-native/card";

import { Icon } from "./icon";

type EmptyStateProps = {
    icon: string;
    title: string;
    description: string;
    actionLabel?: string;
    onAction?: () => void;
    tone?: "default" | "accent";
    footer?: ReactNode;
};

export function EmptyState({
    icon,
    title,
    description,
    actionLabel,
    onAction,
    tone = "default",
    footer,
}: EmptyStateProps) {
    return (
        <Card variant={tone === "accent" ? "secondary" : "default"} className="rounded-[28px]">
            <Card.Body className="items-center gap-4 px-6 py-8">
                <View className="h-16 w-16 items-center justify-center rounded-[24px] bg-default">
                    <Icon name={icon as any} size={28} className={tone === "accent" ? "text-accent" : "text-secondary"} />
                </View>
                <View className="items-center gap-2">
                    <Text className="text-center text-xl font-semibold text-foreground">{title}</Text>
                    <Text className="text-center text-sm leading-6 text-muted">{description}</Text>
                </View>
                {actionLabel && onAction ? (
                    <Button onPress={onAction}>
                        <Button.Label>{actionLabel}</Button.Label>
                    </Button>
                ) : null}
                {footer}
            </Card.Body>
        </Card>
    );
}
