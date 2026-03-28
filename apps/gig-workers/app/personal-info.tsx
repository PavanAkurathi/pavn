import { useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { Button } from "heroui-native/button";
import { Description } from "heroui-native/description";
import { Input } from "heroui-native/input";
import { Label } from "heroui-native/label";
import { Spinner } from "heroui-native/spinner";
import { TextField } from "heroui-native/text-field";

import { LoadingScreen } from "../components/ui/loading-screen";
import { PageHeader } from "../components/ui/page-header";
import { Screen } from "../components/ui/screen";
import { SectionCard } from "../components/ui/section-card";
import { SectionTitle } from "../components/ui/section-title";
import { authClient } from "../lib/auth-client";
import { api } from "../lib/api";

export default function PersonalInfoScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: "", email: "", phone: "" });
    const [original, setOriginal] = useState({ name: "", email: "", phone: "" });

    useEffect(() => {
        void loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const session = await authClient.getSession();
            const user = session.data?.user;
            if (user) {
                const data = {
                    name: user.name || "",
                    email: user.email || "",
                    phone: (user as any).phoneNumber || "",
                };
                setForm(data);
                setOriginal(data);
            }
        } catch (error) {
            console.error("Failed to load profile:", error);
        } finally {
            setLoading(false);
        }
    };

    const hasChanges = form.name !== original.name;

    const handleSave = async () => {
        if (!hasChanges) return;

        setSaving(true);
        try {
            await api.worker.updateProfile({ name: form.name });
            setOriginal({ ...original, name: form.name });
            Alert.alert("Saved", "Your profile has been updated.");
        } catch (error: any) {
            Alert.alert("Error", error.message || "Failed to save");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <LoadingScreen label="Loading your profile" />;
    }

    return (
        <Screen>
            <PageHeader title="Personal info" showBack onBack={() => router.back()} />

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48, gap: 20 }}>
                <View className="gap-3">
                    <SectionTitle label="Identity" />
                    <SectionCard>
                        <TextField isRequired>
                            <Label>Full name</Label>
                            <Input
                                value={form.name}
                                onChangeText={(value) => setForm((current) => ({ ...current, name: value }))}
                                placeholder="Your full name"
                            />
                            <Description>This name is visible to managers across your assigned organizations.</Description>
                        </TextField>
                    </SectionCard>
                </View>

                <View className="gap-3">
                    <SectionTitle label="Contact" />
                    <SectionCard>
                        <TextField isDisabled>
                            <Label>Email</Label>
                            <Input value={form.email} editable={false} />
                        </TextField>
                        <TextField isDisabled>
                            <Label>Phone</Label>
                            <Input value={form.phone} editable={false} />
                            <Description>Email and phone are managed by your organization admin.</Description>
                        </TextField>
                    </SectionCard>
                </View>

                <Button onPress={handleSave} isDisabled={!hasChanges || saving}>
                    {saving ? <Spinner size="sm" /> : null}
                    <Button.Label>{saving ? "Saving" : "Save changes"}</Button.Label>
                </Button>
            </ScrollView>
        </Screen>
    );
}
