"use server";

import { auth, sendSMS } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member, user, organization, invitation, certification } from "@repo/database/schema";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

interface AddMemberInput {
    name: string;
    email: string;
    phoneNumber?: string;
    role: "admin" | "member";
    hourlyRate?: number; // In cents
    jobTitle?: string;
    // Profile Extensions
    image?: string;
    emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
    };
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    };
    certifications?: {
        name: string;
        issuer: string;
        expiresAt: Date;
    }[];
    invites: {
        email: boolean;
        sms: boolean;
    };
}

export async function addMember(input: AddMemberInput) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
        throw new Error("No active organization");
    }

    // Verify permission (must be admin/owner of the org)
    const currentMember = await db.select()
        .from(member)
        .where(and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, activeOrgId)
        ))
        .limit(1);

    if (!currentMember[0] || (currentMember[0].role !== "admin" && currentMember[0].role !== "owner")) {
        throw new Error("Permission denied");
    }

    const { name, email, phoneNumber, role, hourlyRate, jobTitle, invites, image, emergencyContact, address, certifications } = input;

    // 1. Check if user exists
    let targetUserId: string;
    const existingUser = await db.select().from(user).where(eq(user.email, email)).limit(1);

    if (existingUser[0]) {
        targetUserId = existingUser[0].id;
        // Check if already a member
        const existingMember = await db.select()
            .from(member)
            .where(and(
                eq(member.userId, targetUserId),
                eq(member.organizationId, activeOrgId)
            ))
            .limit(1);

        if (existingMember[0]) {
            return { error: "User is already a member of this organization" };
        }

        // TODO: Update existing user profile if needed?
        // For now, we only update if they are just being created to avoid overwriting existing user data
    } else {
        // 2. Create Shadow User
        targetUserId = nanoid();
        await db.insert(user).values({
            id: targetUserId,
            name: name,
            email: email,
            emailVerified: false,
            phoneNumber: phoneNumber || null,
            image: image || null,
            emergencyContact: emergencyContact || null,
            address: address || null,
            createdAt: new Date(),
            updatedAt: new Date(),
        });
    }

    // 3. Add to Organization
    await db.insert(member).values({
        id: nanoid(),
        organizationId: activeOrgId,
        userId: targetUserId,
        role: role,
        hourlyRate: hourlyRate || null,
        jobTitle: jobTitle || null,
        createdAt: new Date(),
    });

    // 4. Add Certifications
    if (certifications && certifications.length > 0) {
        for (const cert of certifications) {
            await db.insert(certification).values({
                id: nanoid(),
                workerId: targetUserId,
                name: cert.name,
                issuer: cert.issuer,
                expiresAt: cert.expiresAt,
                status: "valid",
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }
    }

    // 5. Handle Invitations (Stub for now)
    if (invites.email) {
        // TODO: Send Email Invite via Resend
        console.log(`[Mock] Sending email invite to ${email}`);
    }
    if (invites.sms && phoneNumber) {
        try {
            // In a real app, this link would be dynamic or point to the app store
            const downloadLink = "exp://pavn.link/invite";
            const message = `You've been invited to join ${activeOrgId}'s team on Pavn! Download the app to get started: ${downloadLink}`;
            await sendSMS(phoneNumber, message);
            console.log(`[Team] Sent SMS invite to ${phoneNumber}`);
        } catch (error) {
            console.error(`[Team] Failed to send SMS invite to ${phoneNumber}:`, error);
            // We don't throw here to avoid failing the whole member addition just because SMS failed
        }
    }

    revalidatePath("/settings/team");
    return { success: true };
}

interface BulkImportWorker {
    name: string;
    email: string;
    phoneNumber?: string;
    role: "admin" | "member";
    hourlyRate?: number;
    jobTitle?: string;
    image?: string;
    emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
    };
    certifications?: {
        name: string;
        issuer: string;
        expiresAt: Date;
    }[];
}

export async function bulkImport(workers: BulkImportWorker[]) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
        throw new Error("No active organization");
    }

    // Verify permission
    const currentMember = await db.select()
        .from(member)
        .where(and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, activeOrgId)
        ))
        .limit(1);

    if (!currentMember[0] || (currentMember[0].role !== "admin" && currentMember[0].role !== "owner")) {
        throw new Error("Permission denied");
    }

    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
    };

    for (const workerData of workers) {
        try {
            await addMember({
                ...workerData,
                // Disable auto-invites during bulk to prevent spamming. 
                // Maybe add an option later, but for now safe default.
                invites: { email: false, sms: false }
            });
            results.success++;
        } catch (error: any) {
            results.failed++;
            results.errors.push(`Failed to import ${workerData.email}: ${error.message}`);
        }
    }

    revalidatePath("/settings/team");
    return results;
}

export async function removeMember(memberId: string) {
    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    const activeOrgId = session.session.activeOrganizationId;
    if (!activeOrgId) {
        throw new Error("No active organization");
    }

    // Verify permission (must be admin/owner of the org)
    const currentMember = await db.select()
        .from(member)
        .where(and(
            eq(member.userId, session.user.id),
            eq(member.organizationId, activeOrgId)
        ))
        .limit(1);

    if (!currentMember[0] || (currentMember[0].role !== "admin" && currentMember[0].role !== "owner")) {
        throw new Error("Permission denied");
    }

    // Delete the member from the organization
    await db.delete(member)
        .where(and(
            eq(member.id, memberId),
            eq(member.organizationId, activeOrgId)
        ));

    revalidatePath("/rosters");
    revalidatePath("/settings/team");
    return { success: true };
}
