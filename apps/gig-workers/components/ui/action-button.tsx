import type { ReactNode } from "react";

import { Button } from "heroui-native/button";
import { Spinner } from "heroui-native/spinner";

type ActionButtonProps = {
    label: string;
    onPress: () => void;
    isLoading?: boolean;
    isDisabled?: boolean;
    variant?: "primary" | "secondary" | "danger";
    children?: ReactNode;
};

export function ActionButton({
    label,
    onPress,
    isLoading = false,
    isDisabled = false,
    variant = "primary",
    children,
}: ActionButtonProps) {
    const resolvedVariant = variant === "danger" ? "danger" : variant;

    return (
        <Button onPress={onPress} isDisabled={isDisabled || isLoading} variant={resolvedVariant as any}>
            {isLoading ? <Spinner size="sm" color="default" /> : null}
            {children}
            <Button.Label>{label}</Button.Label>
        </Button>
    );
}
