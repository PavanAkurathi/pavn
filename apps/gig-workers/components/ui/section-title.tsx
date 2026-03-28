import { Text, View } from "react-native";

type SectionTitleProps = {
    label: string;
};

export function SectionTitle({ label }: SectionTitleProps) {
    return (
        <View className="px-1">
            <Text className="text-[11px] font-semibold uppercase tracking-[1.2px] text-muted">
                {label}
            </Text>
        </View>
    );
}
