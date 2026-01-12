import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Image, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import * as ImagePicker from 'expo-image-picker';

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
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [4, 3],
            quality: 1,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSave = () => {
        // Here we would normally upload the image and save the data
        console.log("Saving certification:", { ...form, image });
        router.back();
    };

    return (
        <SafeAreaView style={styles.container} edges={["top"]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="close" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.title}>Add Certification</Text>
                <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                    <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content}>

                {/* Upload Area */}
                <TouchableOpacity style={styles.uploadArea} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.uploadPlaceholder}>
                            <View style={styles.uploadIconCircle}>
                                <Ionicons name="cloud-upload-outline" size={24} color="#007AFF" />
                            </View>
                            <Text style={styles.uploadTitle}>Upload Certificate</Text>
                            <Text style={styles.uploadSubtitle}>Tap to select image</Text>
                        </View>
                    )}
                </TouchableOpacity>
                {image && (
                    <TouchableOpacity onPress={() => setImage(null)} style={styles.removeImageButton}>
                        <Text style={styles.removeImageText}>Remove Image</Text>
                    </TouchableOpacity>
                )}

                {/* Form Fields */}
                <View style={styles.form}>
                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Certification Name</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. ServSafe Alcohol"
                            placeholderTextColor="#666"
                            value={form.name}
                            onChangeText={(t) => setForm(prev => ({ ...prev, name: t }))}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Issuing Organization</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. National Restaurant Association"
                            placeholderTextColor="#666"
                            value={form.issuer}
                            onChangeText={(t) => setForm(prev => ({ ...prev, issuer: t }))}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Text style={styles.label}>Expiration Date</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="YYYY-MM-DD"
                            placeholderTextColor="#666"
                            value={form.expiry}
                            onChangeText={(t) => setForm(prev => ({ ...prev, expiry: t }))}
                            keyboardType="numbers-and-punctuation"
                        />
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#000",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#222",
    },
    backButton: {
        padding: 4,
        marginLeft: -4,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#fff",
    },
    saveButton: {
        padding: 4,
        marginRight: -4,
    },
    saveText: {
        color: "#007AFF",
        fontSize: 16,
        fontWeight: "600",
    },
    content: {
        flex: 1,
        padding: 16,
    },
    uploadArea: {
        height: 200,
        backgroundColor: "#111",
        borderRadius: 12,
        borderWidth: 2,
        borderColor: "#222",
        borderStyle: "dashed",
        overflow: "hidden",
        marginBottom: 8,
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
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: "rgba(0, 122, 255, 0.1)",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 12,
    },
    uploadTitle: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
        marginBottom: 4,
    },
    uploadSubtitle: {
        color: "#666",
        fontSize: 13,
    },
    removeImageButton: {
        alignItems: "center",
        padding: 8,
        marginBottom: 24,
    },
    removeImageText: {
        color: "#FF5252",
        fontSize: 14,
    },
    form: {
        gap: 24,
    },
    inputContainer: {
        gap: 8,
    },
    label: {
        color: "#888",
        fontSize: 13,
        fontWeight: "500",
        marginLeft: 4,
    },
    input: {
        backgroundColor: "#111",
        borderRadius: 8,
        padding: 16,
        color: "#fff",
        fontSize: 16,
        borderWidth: 1,
        borderColor: "#222",
    },
});
