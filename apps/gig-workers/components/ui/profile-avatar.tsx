import { Text, View } from "react-native";

import { Avatar } from "heroui-native/avatar";

type ProfileAvatarProps = {
    name: string;
    image?: string;
};

const getInitials = (name: string) =>
    name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

export function ProfileAvatar({ name, image }: ProfileAvatarProps) {
    return (
        <View className="items-center">
            <Avatar size="lg" variant="soft" color="default" alt={name || "Worker profile"}>
                {image ? <Avatar.Image source={{ uri: image }} /> : null}
                <Avatar.Fallback>
                    <Text className="text-2xl font-semibold text-foreground">{getInitials(name || "?")}</Text>
                </Avatar.Fallback>
            </Avatar>
        </View>
    );
}
