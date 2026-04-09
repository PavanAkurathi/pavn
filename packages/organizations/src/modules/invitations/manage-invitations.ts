import { auth, normalizePhoneNumber, sendSMS } from "@repo/auth";
import { sendInvite } from "@repo/email";
import {
    and,
    db,
    eq,
    inArray,
    resolveWorkerRoleSet,
} from "@repo/database";
import { invitation, member, rosterEntry, user } from "@repo/database/schema";
import {
    BulkWorkerInviteInputSchema,
    TeamMemberInvitationInputSchema,
    WorkerInviteInputSchema,
} from "@repo/contracts";
import {
    buildBusinessInviteUrl,
    getBusinessInvitationState,
} from "./business-invitations";
import { dub } from "@repo/dub";
import { nanoid } from "nanoid";

function getDubClient() {
    return process.env.DUB_API_KEY?.trim() ? dub : null;
}

function getWorkerInvitationUrl(invitationId: string): string {
    return `https://pavn.link/invite?orgToken=${invitationId}`;
}

export async function createTeamInvitation(
    sourceHeaders: Headers,
    organizationId: string,
    payload: unknown,
) {
    const parsed = TeamMemberInvitationInputSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message || "Invalid invitation payload");
    }

    const input = parsed.data;
    const normalizedEmail = input.email.trim().toLowerCase();

    const existingUser = await db.query.user.findFirst({
        where: eq(user.email, normalizedEmail),
        columns: {
            id: true,
        },
    });

    if (existingUser) {
        const existingMember = await db.query.member.findFirst({
            where: and(
                eq(member.userId, existingUser.id),
                eq(member.organizationId, organizationId),
            ),
            columns: {
                id: true,
            },
        });

        if (existingMember) {
            throw new Error("User is already a member of this organization");
        }
    }

    const existingPendingInvitation = await db.query.invitation.findFirst({
        where: and(
            eq(invitation.email, normalizedEmail),
            eq(invitation.organizationId, organizationId),
            eq(invitation.status, "pending"),
        ),
        columns: {
            id: true,
            role: true,
        },
    });

    if (existingPendingInvitation && existingPendingInvitation.role !== input.role) {
        await auth.api.cancelInvitation({
            headers: sourceHeaders,
            body: {
                invitationId: existingPendingInvitation.id,
            },
        });
    }

    const invitationRecord = (await auth.api.createInvitation({
        headers: sourceHeaders,
        body: {
            organizationId,
            email: normalizedEmail,
            role: input.role,
            resend: Boolean(
                existingPendingInvitation &&
                    existingPendingInvitation.role === input.role,
            ),
        },
    })) as { id?: string; invitation?: { id?: string } };

    const invitationId = invitationRecord.id || invitationRecord.invitation?.id;
    if (!invitationId) {
        throw new Error("Failed to create the team invitation");
    }

    const invitationState = await getBusinessInvitationState(invitationId);
    if (!invitationState) {
        throw new Error("Failed to load the pending invitation");
    }

    const inviteUrl = buildBusinessInviteUrl(invitationId, Boolean(existingUser));

    if (input.invites.email) {
        await sendInvite({
            email: normalizedEmail,
            role: input.role,
            inviteUrl,
            organizationName: invitationState.organizationName,
            actionLabel: existingUser
                ? "Review your invitation"
                : "Activate your account",
        });
    }

    if (input.invites.sms && input.phoneNumber) {
        try {
            const message = existingUser
                ? `You've been invited to join ${invitationState.organizationName} on Workers Hive. Review your invitation here: ${inviteUrl}`
                : `You've been invited to join ${invitationState.organizationName} on Workers Hive. Activate your account here: ${inviteUrl}`;
            await sendSMS(input.phoneNumber, message);
        } catch (error) {
            console.error(
                `[TeamInvite] Failed to send SMS invite to ${input.phoneNumber}:`,
                error,
            );
        }
    }

    return { success: true, invitationId };
}

export async function resendTeamInvitation(
    sourceHeaders: Headers,
    organizationId: string,
    invitationId: string,
) {
    const invitationState = await getBusinessInvitationState(invitationId);
    if (!invitationState || invitationState.organizationId !== organizationId) {
        throw new Error("Invitation not found");
    }

    const invitationRecord = (await auth.api.createInvitation({
        headers: sourceHeaders,
        body: {
            organizationId,
            email: invitationState.email,
            role: invitationState.role,
            resend: true,
        },
    })) as { id?: string; invitation?: { id?: string } };

    const effectiveInvitationId =
        invitationRecord.id || invitationRecord.invitation?.id || invitationId;

    const existingUser = await db.query.user.findFirst({
        where: eq(user.email, invitationState.email),
        columns: {
            id: true,
            phoneNumber: true,
        },
    });

    const inviteUrl = buildBusinessInviteUrl(
        effectiveInvitationId,
        Boolean(existingUser),
    );

    await sendInvite({
        email: invitationState.email,
        role: invitationState.role,
        inviteUrl,
        organizationName: invitationState.organizationName,
        actionLabel: existingUser
            ? "Review your invitation"
            : "Activate your account",
    });

    if (existingUser?.phoneNumber) {
        try {
            await sendSMS(
                existingUser.phoneNumber,
                `Reminder: your ${invitationState.organizationName} invitation is ready on Workers Hive. Open: ${inviteUrl}`,
            );
        } catch (error) {
            console.error("[TeamInvite] Failed to resend SMS reminder:", error);
        }
    }

    return { success: true };
}

export async function cancelTeamInvitation(
    sourceHeaders: Headers,
    organizationId: string,
    invitationId: string,
) {
    const invitationRecord = await db.query.invitation.findFirst({
        where: and(
            eq(invitation.id, invitationId),
            eq(invitation.organizationId, organizationId),
        ),
        columns: {
            id: true,
            status: true,
        },
    });

    if (!invitationRecord || invitationRecord.status !== "pending") {
        throw new Error("Invitation not found");
    }

    await auth.api.cancelInvitation({
        headers: sourceHeaders,
        body: {
            invitationId,
        },
    });

    return { success: true };
}

export async function acceptBusinessInvitation(
    sourceHeaders: Headers,
    invitationId: string,
) {
    await auth.api.acceptInvitation({
        headers: sourceHeaders,
        body: {
            invitationId,
        },
    });

    return { success: true };
}

export async function createWorkerInvitation(
    sourceHeaders: Headers,
    organizationId: string,
    payload: unknown,
) {
    const parsed = WorkerInviteInputSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(
            parsed.error.issues[0]?.message || "Invalid worker invite payload",
        );
    }

    const input = parsed.data;
    const normalizedEmail = input.email.trim().toLowerCase();
    const normalizedPhoneNumber = input.phoneNumber
        ? normalizePhoneNumber(input.phoneNumber)
        : null;
    const resolvedRoles = resolveWorkerRoleSet({
        roles: input.roles,
        fallbackRole: input.jobTitle,
    });
    const primaryRole = resolvedRoles[0] ?? input.jobTitle ?? null;

    const existingUser = await db.query.user.findFirst({
        where: eq(user.email, normalizedEmail),
        columns: {
            id: true,
        },
    });

    if (existingUser) {
        const existingMember = await db.query.member.findFirst({
            where: and(
                eq(member.userId, existingUser.id),
                eq(member.organizationId, organizationId),
            ),
            columns: {
                id: true,
            },
        });

        if (existingMember) {
            throw new Error("User is already a member of this organization");
        }
    }

    let invitationId = "";

    try {
        const invitationResponse = (await auth.api.createInvitation({
            headers: sourceHeaders,
            body: {
                organizationId,
                email: normalizedEmail,
                role: input.role,
            },
        })) as { id?: string; invitation?: { id?: string } };

        invitationId =
            invitationResponse.id || invitationResponse.invitation?.id || "";
    } catch (error: any) {
        if (!error?.message?.includes("already invited")) {
            throw error;
        }

        const existingInvite = await db.query.invitation.findFirst({
            where: and(
                eq(invitation.email, normalizedEmail),
                eq(invitation.organizationId, organizationId),
                eq(invitation.status, "pending"),
            ),
            columns: {
                id: true,
            },
        });

        if (!existingInvite) {
            throw new Error("User is allegedly invited but no record was found");
        }

        invitationId = existingInvite.id;
    }

    if (!invitationId) {
        throw new Error("Failed to generate or fetch Better Auth invitation ID");
    }

    const existingRoster = await db.query.rosterEntry.findFirst({
        where: and(
            eq(rosterEntry.email, normalizedEmail),
            eq(rosterEntry.organizationId, organizationId),
        ),
    });

    if (existingRoster) {
        await db.update(rosterEntry)
            .set({
                name: input.name,
                phoneNumber: normalizedPhoneNumber || existingRoster.phoneNumber,
                jobTitle: primaryRole || existingRoster.jobTitle,
                roles:
                    resolvedRoles.length > 0
                        ? resolvedRoles
                        : existingRoster.roles || [],
                hourlyRate:
                    input.hourlyRate !== undefined
                        ? input.hourlyRate
                        : existingRoster.hourlyRate,
                status: "invited",
                role: input.role,
            })
            .where(eq(rosterEntry.id, existingRoster.id));
    } else {
        await db.insert(rosterEntry).values({
            id: nanoid(),
            organizationId,
            name: input.name,
            email: normalizedEmail,
            phoneNumber: normalizedPhoneNumber,
            jobTitle: primaryRole,
            roles: resolvedRoles,
            hourlyRate: input.hourlyRate !== undefined ? input.hourlyRate : null,
            status: "invited",
            role: input.role,
            createdAt: new Date(),
        });
    }

    let shortLink = "";

    if (input.invites.sms && normalizedPhoneNumber) {
        try {
            const originalUrl = getWorkerInvitationUrl(invitationId);
            const dub = getDubClient();

            if (dub) {
                const link = await dub.links.create({
                    url: originalUrl,
                    domain:
                        process.env.NEXT_PUBLIC_DUB_DOMAIN ||
                        "links.workershive.com",
                });
                shortLink = link.shortLink;
            } else {
                shortLink = originalUrl;
            }

            await sendSMS(
                normalizedPhoneNumber,
                `You've been invited to join the team on WorkersHive! Click here to download the app and join: ${shortLink}`,
            );
        } catch (error: any) {
            console.error(
                "[WorkerInvite] Dub.co Link Generation or SMS Error:",
                error,
            );

            if (process.env.NODE_ENV !== "development") {
                throw new Error(
                    `Failed to create short link or send SMS: ${error.message}`,
                );
            }
        }
    }

    if (process.env.NODE_ENV === "development" && !shortLink) {
        shortLink = `https://${process.env.NEXT_PUBLIC_DUB_DOMAIN || "links.workershive.com"}/fake-dev-link?orgToken=${invitationId}`;
    }

    return { success: true, link: shortLink };
}

export async function bulkInviteWorkers(
    sourceHeaders: Headers,
    organizationId: string,
    payload: unknown,
) {
    const parsed = BulkWorkerInviteInputSchema.safeParse(payload);
    if (!parsed.success) {
        throw new Error(
            parsed.error.issues[0]?.message || "Invalid bulk invite payload",
        );
    }

    const entries = await db.query.rosterEntry.findMany({
        where: and(
            inArray(rosterEntry.id, parsed.data),
            eq(rosterEntry.organizationId, organizationId),
        ),
    });

    let successCount = 0;
    const dub = getDubClient();

    for (const entry of entries) {
        try {
            const invitationResponse = (await auth.api.createInvitation({
                headers: sourceHeaders,
                body: {
                    organizationId,
                    email: entry.email,
                    role: (entry.role as "admin" | "member") || "member",
                },
            })) as { id?: string; invitation?: { id?: string } };

            const invitationId =
                invitationResponse.id || invitationResponse.invitation?.id;

            if (entry.phoneNumber && invitationId) {
                try {
                    const originalUrl = getWorkerInvitationUrl(invitationId);
                    const shortLink = dub
                        ? (
                              await dub.links.create({
                                  url: originalUrl,
                                  domain:
                                      process.env.NEXT_PUBLIC_DUB_DOMAIN ||
                                      "links.workershive.com",
                              })
                          ).shortLink
                        : originalUrl;

                    await sendSMS(
                        entry.phoneNumber,
                        `You've been invited to join the team on WorkersHive! Download the app and join: ${shortLink}`,
                    );
                } catch (error: any) {
                    console.error("[BulkInvite] Dub.co/SMS Error:", error.message);
                }
            }

            await db.update(rosterEntry)
                .set({ status: "invited" })
                .where(eq(rosterEntry.id, entry.id));

            successCount++;
        } catch (error: any) {
            console.error(
                `[BulkInvite] Failed to invite ${entry.email}:`,
                error.message,
            );
        }
    }

    return { success: true, count: successCount };
}
