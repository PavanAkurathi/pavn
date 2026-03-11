import { and, eq, or, sql } from "drizzle-orm";
import { db } from "@repo/database";
import {
    invitation,
    member,
    organization,
    rosterEntry,
    user,
} from "@repo/database/schema";
import { isValidPhoneNumber, normalizePhoneNumber } from "./providers/sms";

type WorkerRosterAccess = {
    organizationId: string;
    organizationName: string;
    rosterEntryId: string;
    name: string;
    email: string;
    role: string | null;
    jobTitle: string | null;
    hourlyRate: number | null;
    status: string;
};

export type WorkerPhoneAccess = {
    normalizedPhoneNumber: string;
    eligible: boolean;
    organizationCount: number;
    existingAccount: boolean;
    existingUserId: string | null;
    displayName: string | null;
    organizationIds: string[];
    rosterAccess: WorkerRosterAccess[];
};

function toUniqueOrganizationIds(values: Array<{ organizationId: string }>): string[] {
    return [...new Set(values.map((value) => value.organizationId))];
}

export function getWorkerTempEmail(phoneNumber: string): string {
    const digits = phoneNumber.replace(/\D/g, "");
    return `worker+${digits}@workershive.local`;
}

export async function getWorkerPhoneAccess(phoneNumber: string): Promise<WorkerPhoneAccess> {
    if (!isValidPhoneNumber(phoneNumber)) {
        throw new Error("Invalid phone number");
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    const normalizedDigits = normalizedPhoneNumber.replace(/\D/g, "");

    const existingUser = await db.query.user.findFirst({
        where: eq(user.phoneNumber, normalizedPhoneNumber),
        columns: {
            id: true,
            name: true,
        },
    });

    const activeMemberships = existingUser
        ? await db
            .select({ organizationId: member.organizationId })
            .from(member)
            .where(and(eq(member.userId, existingUser.id), eq(member.status, "active")))
        : [];

    const rosterAccess = await db
        .select({
            organizationId: rosterEntry.organizationId,
            organizationName: organization.name,
            rosterEntryId: rosterEntry.id,
            name: rosterEntry.name,
            email: rosterEntry.email,
            role: rosterEntry.role,
            jobTitle: rosterEntry.jobTitle,
            hourlyRate: rosterEntry.hourlyRate,
            status: rosterEntry.status,
        })
        .from(rosterEntry)
        .innerJoin(organization, eq(rosterEntry.organizationId, organization.id))
        .where(sql`regexp_replace(coalesce(${rosterEntry.phoneNumber}, ''), '[^0-9]', '', 'g') = ${normalizedDigits}`);

    const organizationIds = [...new Set([
        ...toUniqueOrganizationIds(activeMemberships),
        ...toUniqueOrganizationIds(rosterAccess),
    ])];

    return {
        normalizedPhoneNumber,
        eligible: organizationIds.length > 0,
        organizationCount: organizationIds.length,
        existingAccount: Boolean(existingUser),
        existingUserId: existingUser?.id ?? null,
        displayName: existingUser?.name ?? rosterAccess[0]?.name ?? null,
        organizationIds,
        rosterAccess,
    };
}

export async function syncWorkerMembershipsForPhone(userId: string, phoneNumber: string): Promise<string[]> {
    const access = await getWorkerPhoneAccess(phoneNumber);
    if (!access.eligible) {
        throw new Error("This phone number has not been added to any organization.");
    }

    const existingUser = await db.query.user.findFirst({
        where: eq(user.id, userId),
        columns: {
            id: true,
            name: true,
            updatedAt: true,
        },
    });

    const currentMemberships = await db
        .select({
            id: member.id,
            organizationId: member.organizationId,
            status: member.status,
        })
        .from(member)
        .where(eq(member.userId, userId));

    const membershipByOrgId = new Map(
        currentMemberships.map((membership) => [membership.organizationId, membership])
    );

    for (const roster of access.rosterAccess) {
        const existingMembership = membershipByOrgId.get(roster.organizationId);
        if (existingMembership) {
            if (existingMembership.status !== "active") {
                await db
                    .update(member)
                    .set({
                        status: "active",
                        role: roster.role ?? "member",
                        jobTitle: roster.jobTitle,
                        hourlyRate: roster.hourlyRate,
                        updatedAt: new Date(),
                    })
                    .where(eq(member.id, existingMembership.id));
            }
        } else {
            await db.insert(member).values({
                id: crypto.randomUUID(),
                organizationId: roster.organizationId,
                userId,
                role: roster.role ?? "member",
                status: "active",
                jobTitle: roster.jobTitle,
                hourlyRate: roster.hourlyRate,
                createdAt: new Date(),
                updatedAt: new Date(),
            });
        }

        await db
            .update(rosterEntry)
            .set({ status: "active" })
            .where(eq(rosterEntry.id, roster.rosterEntryId));

        if (roster.email) {
            await db
                .update(invitation)
                .set({ status: "accepted" })
                .where(and(
                    eq(invitation.organizationId, roster.organizationId),
                    eq(invitation.email, roster.email),
                    or(eq(invitation.status, "pending"), eq(invitation.status, "accepted"))
                ));
        }
    }

    const nextUserValues: {
        role: string;
        updatedAt: Date;
        name?: string;
    } = {
        role: "worker",
        updatedAt: new Date(),
    };

    if (
        access.displayName &&
        existingUser &&
        (!existingUser.name || existingUser.name === access.normalizedPhoneNumber || existingUser.name === phoneNumber)
    ) {
        nextUserValues.name = access.displayName;
    }

    await db.update(user).set(nextUserValues).where(eq(user.id, userId));

    return access.organizationIds;
}
