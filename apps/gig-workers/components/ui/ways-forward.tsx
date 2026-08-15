import { Text, View } from "react-native";

/**
 * Numbered exits from a dead end.
 *
 * A worker who cannot clock in is standing at a gate with a shift starting. The
 * screen owes them the order to try things in, not an explanation of why they
 * are stuck — so the number leads, the instruction follows, and there is always
 * a last step that works even when the first two do not.
 */
export function WaysForward({ steps, title = "Try in this order" }: { steps: string[]; title?: string }) {
    if (steps.length === 0) return null;

    return (
        <View className="gap-2 rounded-xl border border-border bg-background p-3">
            <Text className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</Text>
            {steps.map((step, index) => (
                <View key={step} className="flex-row gap-2.5">
                    <Text className="text-xs font-bold tabular-nums text-primary">
                        {String(index + 1).padStart(2, "0")}
                    </Text>
                    <Text className="flex-1 text-sm text-foreground">{step}</Text>
                </View>
            ))}
        </View>
    );
}
