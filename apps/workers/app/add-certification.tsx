import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    TextInput,
    Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from "expo-image-picker";
import { workerTheme } from "../lib/theme";

export default function AddCertificationScreen() {
    const router = useRouter();
    const [image, setImage] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: "",
        issuer: "",
        expiry: "",
    });

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSave = () => {
        router.back();
    };

    return (
        <SafeAreaView style={s.container} edges={["top"]}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => router.back()} style={s.headerButton}>
                    <Ionicons name="close" size={24} color={workerTheme.colors.foreground} />
                </TouchableOpacity>
                <Text style={s.title}>Add Certification</Text>
                <TouchableOpacity onPress={handleSave} style={s.headerButton}>
                    <Text style={s.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={s.content}>
                <TouchableOpacity style={s.uploadArea} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image }} style={s.previewImage} />
                    ) : (
                        <View style={s.uploadPlaceholder}>
                            <View style={s.uploadIconCircle}>
                                <Ionicons
                                    name="cloud-upload-outline"
                                    size={24}
                                    color={workerTheme.colors.secondary}
                                />
                            </View>
                            <Text style={s.uploadTitle}>Upload certificate</Text>
                            <Text style={s.uploadSubtitle}>Tap to select an image</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {image ? (
                    <TouchableOpacity onPress={() => setImage(null)} style={s.removeImageButton}>
                        <Text style={s.removeImageText}>Remove image</Text>
                    </TouchableOpacity>
                ) : null}

                <View style={s.form}>
                    <View style={s.inputContainer}>
                        <Text style={s.label}>Certification Name</Text>
                        <TextInput
                            style={s.input}
                            placeholder="e.g. ServSafe Alcohol"
                            placeholderTextColor={workerTheme.colors.subtleForeground}
                            value={form.name}
                            onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                        />
                    </View>

                    <View style={s.inputContainer}>
                        <Text style={s.label}>Issuing Organization</Text>
                        <TextInput
                            style={s.input}
                            placeholder="e.g. National Restaurant Association"
                            placeholderTextColor={workerTheme.colors.subtleForeground}
                            value={form.issuer}
                            onChangeText={(value) => setForm((current) => ({ ...current, issuer: value }))}
                        />
                    </View>

                    <View style={s.inputContainer}>
                        <Text style={s.label}>Expiration Date</Text>
                        <TextInput
                            style={s.input}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor={workerTheme.colors.subtleForeground}
                            value={form.expiry}
                            onChangeText={(value) => setForm((current) => ({ ...current, expiry: value }))}
                            keyboardType="numbers-and-punctuation"
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: workerTheme.colors.background,
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: workerTheme.colors.border,
    },
    headerButton: {
        minWidth: 48,
        alignItems: "center",
    },
    title: {
        fontSize: 18,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
    },
    saveText: {
        fontSize: 16,
        fontWeight: "600",
        color: workerTheme.colors.primary,
    },
    content: {
        padding: 16,
        paddingBottom: 40,
    },
    uploadArea: {
        height: 220,
        marginBottom: 8,
        borderRadius: 18,
        borderWidth: 2,
        borderStyle: "dashed",
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
        overflow: "hidden",
        justifyContent: "center",
        alignItems: "center",
    },
    previewImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    uploadPlaceholder: {
        alignItems: "center",
    },
    uploadIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: workerTheme.colors.secondarySoft,
        marginBottom: 12,
    },
    uploadTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: workerTheme.colors.foreground,
        marginBottom: 4,
    },
    uploadSubtitle: {
        fontSize: 13,
        color: workerTheme.colors.mutedForeground,
    },
    removeImageButton: {
        alignItems: "center",
        paddingVertical: 8,
        marginBottom: 20,
    },
    removeImageText: {
        fontSize: 14,
        color: workerTheme.colors.primary,
    },
    form: {
        gap: 20,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        fontSize: 13,
        fontWeight: "600",
        color: workerTheme.colors.mutedForeground,
        marginLeft: 4,
    },
    input: {
        borderRadius: 14,
        borderWidth: 1,
        borderColor: workerTheme.colors.border,
        backgroundColor: workerTheme.colors.surface,
        padding: 16,
        color: workerTheme.colors.foreground,
        fontSize: 16,
    },
});
