"use server";

import { auth } from "@repo/auth";
import { headers } from "next/headers";
import { db } from "@repo/database";
import { member, rosterEntry } from "@repo/database/schema";
import { eq, and } from "@repo/database";
import { nanoid } from "nanoid";
import { revalidatePath } from "next/cache";

import { z } from "zod";

interface BulkImportWorker {
    name: string;
    email: string;
    phoneNumber?: string;
    role: "admin" | "member";
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
    hourlyRate?: number;
}

const bulkImportWorkerSchema = z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phoneNumber: z.string().optional(),
    role: z.enum(["admin", "member"]),
    jobTitle: z.string().optional(),
    image: z.string().optional(),
    emergencyContact: z.object({
        name: z.string(),
        phone: z.string(),
        relation: z.string(),
    }).optional(),
    certifications: z.array(z.object({
        name: z.string(),
        issuer: z.string(),
        expiresAt: z.coerce.date(),
    })).optional(),
    hourlyRate: z.number().optional(),
});

const bulkImportSchema = z.array(bulkImportWorkerSchema);

export async function bulkImport(rawWorkers: BulkImportWorker[]) {
    const parsed = bulkImportSchema.safeParse(rawWorkers);
    if (!parsed.success) {
        throw new Error("Invalid input data: " + parsed.error.message);
    }
    const workers = parsed.data;

    const session = await auth.api.getSession({
        headers: await headers()
    });

    if (!session) {
        throw new Error("Unauthorized");
    }

    // Better-auth v1.2.0 compatibility: explicit cast for activeOrganizationId
    const activeOrgId = (session.session as any).activeOrganizationId as string || undefined;
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
            await db.insert(rosterEntry).values({
                id: nanoid(),
                organizationId: activeOrgId,
                name: workerData.name,
                email: workerData.email,
                phoneNumber: workerData.phoneNumber || null,
                role: workerData.role || "member",
                jobTitle: workerData.jobTitle || null,
                hourlyRate: workerData.hourlyRate || null,
                status: "uninvited"
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
