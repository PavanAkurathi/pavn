import { db } from "@repo/database";
import { deviceToken } from "@repo/database/schema";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import Expo from "expo-server-sdk";

type RegisterDeviceTokenInput = {
    pushToken: string;
    platform: "ios" | "android" | "web";
    deviceName?: string;
    appVersion?: string;
    osVersion?: string;
};

export async function registerDeviceToken(
    userId: string,
    payload: RegisterDeviceTokenInput,
) {
    const { pushToken, platform, deviceName, appVersion, osVersion } = payload;

    if (!Expo.isExpoPushToken(pushToken)) {
        throw new Error("Invalid push token format");
    }

    const now = new Date();

    await db.insert(deviceToken)
        .values({
            id: nanoid(),
            userId,
            pushToken,
            platform,
            deviceName,
            appVersion,
            osVersion,
            isActive: true,
            lastUsedAt: now,
            createdAt: now,
            updatedAt: now,
        })
        .onConflictDoUpdate({
            target: [deviceToken.userId, deviceToken.pushToken],
            set: {
                isActive: true,
                lastUsedAt: now,
                deviceName,
                appVersion,
                osVersion,
                updatedAt: now,
            },
        });

    return { success: true };
}

export async function listActiveDeviceTokens(userId: string) {
    return db.query.deviceToken.findMany({
        where: and(
            eq(deviceToken.userId, userId),
            eq(deviceToken.isActive, true),
        ),
        columns: {
            id: true,
            platform: true,
            deviceName: true,
            appVersion: true,
            lastUsedAt: true,
            createdAt: true,
        },
    });
}

export async function unregisterDeviceToken(userId: string, tokenId: string) {
    const result = await db.update(deviceToken)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
            eq(deviceToken.id, tokenId),
            eq(deviceToken.userId, userId),
        ))
        .returning({ id: deviceToken.id });

    return result.length > 0;
}
