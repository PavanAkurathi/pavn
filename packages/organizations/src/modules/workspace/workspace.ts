import { sendSMS, isValidPhoneNumber, normalizePhoneNumber } from "@repo/auth";
import { SUPPORT_EMAIL, PLAN_LIMITS } from "@repo/config";
import {
    and,
    db,
    desc,
    eq,
    ne,
    resolveWorkerRoleSet,
} from "@repo/database";
import {
    invitation,
    location,
    member,
    organization,
    rosterEntry,
    user,
    workerRole,
} from "@repo/database/schema";
import { sendInvite } from "@repo/email";
import {
    BulkImportWorkersInputSchema,
    OrganizationProfileUpdateSchema,
    RemoveWorkerByEmailSchema,
} from "@repo/contracts";
import { AppError } from "@repo/observability";
import { getCrew } from "@repo/gig-workers";
import { getBusinessInvitationState } from "../invitations/business-invitations";
import { nanoid } from "nanoid";

type OrganizationMetadata = {
    description?: string;
    onboarding?: {
        businessInformationCompleted?: boolean;
        billingPromptHandled?: boolean;
    };
    [key: string]: unknown;
};

function parseOrganizationMetadata(
    raw: string | null | undefined,
): OrganizationMetadata {
    if (!raw) {
        return {};
    }

    try {
        const parsed = JSON.parse(raw);
        if (typeof parsed === "string") {
            return { description: parsed };
        }
        if (parsed && typeof parsed === "object") {
            return parsed as OrganizationMetadata;
        }
    } catch {
        return { description: raw };
    }

    return {};
}

function serializeOrganizationMetadata(metadata: OrganizationMetadata) {
    const next: OrganizationMetadata = {};

    if (metadata.description) {
        next.description = metadata.description;
    }

    if (
        metadata.onboarding?.businessInformationCompleted ||
        metadata.onboarding?.billingPromptHandled
    ) {
        next.onboarding = {
            ...(metadata.onboarding?.businessInformationCompleted
                ? { businessInformationCompleted: true }
                : {}),
            ...(metadata.onboarding?.billingPromptHandled
                ? { billingPromptHandled: true }
                : {}),
        };
    }

    return JSON.stringify(next);
}

export async function getOrganizationSummary(orgId: string) {
    return (
        (await db.query.organization.findFirst({
            where: eq(organization.id, orgId),
            columns: {
                id: true,
                name: true,
                logo: true,
            },
        })) ?? null
    );
}

export async function getDefaultOrganizationContext(
    userId: string | null | undefined,
    activeOrganizationId?: string | null,
) {
    if (activeOrganizationId) {
        return { organizationId: activeOrganizationId };
    }

    if (!userId) {
        return { organizationId: null };
    }

    const membership = await db.query.member.findFirst({
        where: eq(member.userId, userId),
        columns: {
            organizationId: true,
        },
    });

    return { organizationId: membership?.organizationId ?? null };
}

export async function getOrganizationMembershipContext(userId: string, orgId: string) {
    const membership = await db.query.member.findFirst({
        where: and(eq(member.organizationId, orgId), eq(member.userId, userId)),
        columns: {
            id: true,
            role: true,
        },
    });

    if (!membership) {
        return null;
    }

    return {
        memberId: membership.id,
        organizationId: orgId,
        role: membership.role,
    };
}

export async function getOrganizationContacts(orgId: string) {
    const members = await db
        .select({
            id: member.id,
            userId: member.userId,
            role: member.role,
            user: {
                name: user.name,
                email: user.email,
                phone: user.phoneNumber,
            },
        })
        .from(member)
        .innerJoin(user, eq(member.userId, user.id))
        .where(eq(member.organizationId, orgId));

    return members.map((entry) => ({
        id: entry.userId,
        memberId: entry.id,
        userId: entry.userId,
        name: entry.user.name,
        phone: entry.user.phone || "",
        initials: entry.user.name
            .split(" ")
            .map((part) => part[0] || "")
            .join("")
            .substring(0, 2)
            .toUpperCase(),
        role: entry.role.charAt(0).toUpperCase() + entry.role.slice(1),
    }));
}

export async function getScheduleBootstrap(orgId: string) {
    return {
        crew: await getCrew(orgId, { limit: 500, offset: 0 }),
    };
}

export async function getWorkspaceSettings(
    orgId: string,
    userId: string,
) {
    const [organizationRecord, locations, memberRecord, teamResult, pendingInvitations] =
        await Promise.all([
            db
                .select({
                    id: organization.id,
                    name: organization.name,
                    slug: organization.slug,
                    logo: organization.logo,
                    metadata: organization.metadata,
                    timezone: organization.timezone,
                    attendanceVerificationPolicy:
                        organization.attendanceVerificationPolicy,
                })
                .from(organization)
                .where(eq(organization.id, orgId))
                .limit(1),
            db
                .select()
                .from(location)
                .where(eq(location.organizationId, orgId))
                .orderBy(desc(location.createdAt)),
            db
                .select({
                    role: member.role,
                })
                .from(member)
                .where(and(eq(member.userId, userId), eq(member.organizationId, orgId)))
                .limit(1),
            db
                .select({
                    id: member.id,
                    role: member.role,
                    joinedAt: member.createdAt,
                    status: member.status,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        image: user.image,
                        emailVerified: user.emailVerified,
                    },
                })
                .from(member)
                .leftJoin(user, eq(member.userId, user.id))
                .where(eq(member.organizationId, orgId)),
            db
                .select({
                    id: invitation.id,
                    role: invitation.role,
                    joinedAt: invitation.createdAt,
                    email: invitation.email,
                    user: {
                        id: user.id,
                        name: user.name,
                        image: user.image,
                    },
                })
                .from(invitation)
                .leftJoin(user, eq(invitation.email, user.email))
                .where(
                    and(
                        eq(invitation.organizationId, orgId),
                        eq(invitation.status, "pending"),
                    ),
                ),
        ]);

    const members = [
        ...teamResult
            .filter((entry) => entry.user !== null)
            .map((entry) => ({
                id: entry.id,
                entryType: "member" as const,
                role: entry.role || "member",
                joinedAt: entry.joinedAt ?? new Date(),
                name: entry.user!.name,
                email: entry.user!.email,
                image: entry.user!.image,
                status: (entry.status === "active" ? "active" : "invited") as
                    | "active"
                    | "invited",
                user: {
                    id: entry.user!.id,
                },
            })),
        ...pendingInvitations.map((entry) => ({
            id: entry.id,
            entryType: "invitation" as const,
            role: entry.role || "member",
            joinedAt: entry.joinedAt ?? new Date(),
            name: entry.user?.name || entry.email,
            email: entry.email,
            image: entry.user?.image || null,
            status: "invited" as const,
            user: entry.user ? { id: entry.user.id } : undefined,
        })),
    ].sort(
        (left, right) =>
            new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime(),
    );

    return {
        organization: organizationRecord[0] ?? null,
        locations,
        role: memberRecord[0]?.role || "member",
        members,
    };
}

export async function getRosterWorkers(orgId: string) {
    const [workersResult, invitations, rosterEntries] = await Promise.all([
        db
            .select({
                id: member.id,
                role: member.role,
                joinedAt: member.createdAt,
                jobTitle: member.jobTitle,
                hourlyRate: member.hourlyRate,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    image: user.image,
                    emailVerified: user.emailVerified,
                    phoneNumber: user.phoneNumber,
                    emergencyContact: user.emergencyContact,
                },
            })
            .from(member)
            .leftJoin(user, eq(member.userId, user.id))
            .where(
                and(
                    eq(member.organizationId, orgId),
                    ne(member.role, "owner"),
                    ne(member.role, "admin"),
                ),
            ),
        db
            .select()
            .from(invitation)
            .where(eq(invitation.organizationId, orgId)),
        db
            .select()
            .from(rosterEntry)
            .where(eq(rosterEntry.organizationId, orgId)),
    ]);

    const invitedEmails = new Set(invitations.map((entry) => entry.email));
    const rosterEmails = new Set(rosterEntries.map((entry) => entry.email));

    const mappedRoster = rosterEntries.map((entry) => {
        const isInvited =
            entry.status === "invited" || invitedEmails.has(entry.email);
        return {
            id: entry.id,
            role: entry.role,
            joinedAt: entry.createdAt || new Date(),
            jobTitle: entry.jobTitle,
            name: entry.name,
            email: entry.email,
            phone: entry.phoneNumber,
            image: null,
            status: (isInvited ? "invited" : "uninvited") as
                | "invited"
                | "uninvited",
            hourlyRate: entry.hourlyRate,
            emergencyContact: null,
        };
    });

    const mappedMembers = workersResult
        .filter((entry) => entry.user !== null)
        .map((entry) => ({
            id: entry.id,
            role: entry.role,
            joinedAt: entry.joinedAt,
            jobTitle: entry.jobTitle,
            name: entry.user!.name,
            email: entry.user!.email,
            phone: entry.user!.phoneNumber,
            image: entry.user!.image,
            status: (entry.user!.emailVerified ? "active" : "invited") as
                | "active"
                | "invited",
            hourlyRate: entry.hourlyRate,
            emergencyContact: entry.user!.emergencyContact as
                | { name: string; phone: string; relation?: string }
                | null,
        }));

    const memberEmails = new Set(mappedMembers.map((entry) => entry.email));

    const mappedInvitations = invitations
        .filter(
            (entry) =>
                !rosterEmails.has(entry.email) && !memberEmails.has(entry.email),
        )
        .map((entry) => ({
            id: entry.id,
            role: entry.role,
            joinedAt: entry.createdAt || new Date(),
            jobTitle: entry.role,
            name: entry.email,
            email: entry.email,
            phone: null,
            image: null,
            status: "invited" as const,
            hourlyRate: null,
            emergencyContact: null,
        }));

    return [...mappedMembers, ...mappedRoster, ...mappedInvitations].sort(
        (left, right) =>
            new Date(right.joinedAt).getTime() - new Date(left.joinedAt).getTime(),
    );
}

export async function getWorkerProfile(orgId: string, id: string) {
    const memberRecord = await db.query.member.findFirst({
        where: and(eq(member.id, id), eq(member.organizationId, orgId)),
        with: {
            user: true,
        },
    });

    let displayData = {
        name: "",
        email: "",
        phone: null as string | null,
        image: null as string | null,
        status: "Unknown",
        emergencyContact: null as
            | { name: string; phone: string; relation?: string }
            | null,
        joinedAt: new Date(),
        userId: null as string | null,
    };

    if (memberRecord) {
        displayData = {
            name: memberRecord.user.name,
            email: memberRecord.user.email,
            phone: memberRecord.user.phoneNumber,
            image: memberRecord.user.image,
            status: memberRecord.user.emailVerified ? "Active" : "Invited",
            emergencyContact: memberRecord.user.emergencyContact,
            joinedAt: memberRecord.createdAt,
            userId: memberRecord.user.id,
        };
    } else {
        const rosterRecord = await db.query.rosterEntry.findFirst({
            where: and(eq(rosterEntry.id, id), eq(rosterEntry.organizationId, orgId)),
        });

        if (!rosterRecord) {
            return null;
        }

        displayData = {
            name: rosterRecord.name,
            email: rosterRecord.email,
            phone: rosterRecord.phoneNumber,
            image: null,
            status: rosterRecord.status === "invited" ? "Invited" : "Uninvited",
            emergencyContact: null,
            joinedAt: rosterRecord.createdAt || new Date(),
            userId: null,
        };
    }

    const roles = displayData.userId
        ? await db.query.workerRole.findMany({
              where: and(
                  eq(workerRole.workerId, displayData.userId),
                  eq(workerRole.organizationId, orgId),
              ),
              orderBy: (rolesTable, { desc: orderDesc }) => [
                  orderDesc(rolesTable.createdAt),
              ],
          })
        : [];

    return {
        displayData,
        roles,
    };
}

export async function createLocationWithPlanLimit(
    orgId: string,
    payload: {
        name: string;
        address: string;
        timezone?: string;
        geofenceRadius?: number;
        geofenceRadiusMeters?: number;
    },
) {
    const locations = await db
        .select({ id: location.id })
        .from(location)
        .where(eq(location.organizationId, orgId));

    if (locations.length >= PLAN_LIMITS.MAX_LOCATIONS) {
        throw new AppError(
            `Your plan supports up to ${PLAN_LIMITS.MAX_LOCATIONS} locations. Need more? Contact us at ${SUPPORT_EMAIL} to upgrade.`,
            "PLAN_LIMIT_REACHED",
            400,
        );
    }

    return payload;
}

export async function updateOrganizationProfile(orgId: string, payload: unknown) {
    const parsed = OrganizationProfileUpdateSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message || "Invalid organization payload",
            "VALIDATION_ERROR",
            400,
        );
    }

    const currentOrganization = await db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: {
            metadata: true,
        },
    });

    const metadata = parseOrganizationMetadata(currentOrganization?.metadata);

    if (parsed.data.description !== undefined) {
        metadata.description = parsed.data.description;
    }

    if (parsed.data.markBusinessInformationComplete) {
        metadata.onboarding = {
            ...metadata.onboarding,
            businessInformationCompleted: true,
        };
    }

    await db
        .update(organization)
        .set({
            name: parsed.data.name,
            metadata: serializeOrganizationMetadata(metadata),
            timezone: parsed.data.timezone,
            attendanceVerificationPolicy:
                parsed.data.attendanceVerificationPolicy,
        })
        .where(eq(organization.id, orgId));

    return { success: true };
}

export async function markBillingPromptHandled(orgId: string) {
    const currentOrganization = await db.query.organization.findFirst({
        where: eq(organization.id, orgId),
        columns: {
            metadata: true,
        },
    });

    const metadata = parseOrganizationMetadata(currentOrganization?.metadata);
    metadata.onboarding = {
        ...metadata.onboarding,
        billingPromptHandled: true,
    };

    await db
        .update(organization)
        .set({
            metadata: serializeOrganizationMetadata(metadata),
        })
        .where(eq(organization.id, orgId));

    return { success: true };
}

export async function removeOrganizationMember(orgId: string, memberId: string) {
    await db
        .delete(member)
        .where(and(eq(member.id, memberId), eq(member.organizationId, orgId)));

    return { success: true };
}

export async function resendOrganizationMemberInvite(
    orgId: string,
    memberId: string,
) {
    const memberRecord = await db.query.member.findFirst({
        where: and(eq(member.id, memberId), eq(member.organizationId, orgId)),
        with: {
            user: true,
        },
    });

    if (!memberRecord || !memberRecord.user) {
        throw new AppError("Member not found", "NOT_FOUND", 404);
    }

    const { phoneNumber, email } = memberRecord.user;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const methods: string[] = [];

    if (email && process.env.RESEND_API_KEY) {
        await sendInvite({
            email,
            role: memberRecord.role,
            inviteUrl: `${appUrl}/auth/login`,
            actionLabel: "Go to login",
        });
        methods.push("email");
    }

    if (phoneNumber) {
        const loginUrl = `${appUrl}/auth/login`;
        const message = `REMINDER: You've been invited to join your team on Workers Hive. Sign in here: ${loginUrl}`;

        try {
            await sendSMS(phoneNumber, message);
            methods.push("sms");
        } catch (error) {
            console.error("Failed to resend SMS", error);
            if (methods.length === 0) {
                throw new AppError(
                    "Failed to send invite",
                    "DELIVERY_FAILED",
                    500,
                );
            }
        }
    }

    if (methods.length === 0) {
        throw new AppError(
            "No invite delivery method is configured for this member",
            "NO_DELIVERY_METHOD",
            400,
        );
    }

    return { success: true, method: methods.join("+") };
}

export async function removeWorkerByEmail(orgId: string, payload: unknown) {
    const parsed = RemoveWorkerByEmailSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AppError(
            "Invalid email address",
            "VALIDATION_ERROR",
            400,
        );
    }

    const emailAddress = parsed.data.email.trim().toLowerCase();
    const targetUser = await db.query.user.findFirst({
        where: eq(user.email, emailAddress),
        columns: {
            id: true,
        },
    });

    if (targetUser) {
        await db
            .delete(member)
            .where(
                and(
                    eq(member.userId, targetUser.id),
                    eq(member.organizationId, orgId),
                ),
            );
    }

    await db
        .delete(invitation)
        .where(
            and(
                eq(invitation.email, emailAddress),
                eq(invitation.organizationId, orgId),
            ),
        );

    await db
        .delete(rosterEntry)
        .where(
            and(
                eq(rosterEntry.email, emailAddress),
                eq(rosterEntry.organizationId, orgId),
            ),
        );

    return { success: true };
}

export async function bulkImportRosterEntries(orgId: string, payload: unknown) {
    const parsed = BulkImportWorkersInputSchema.safeParse(payload);
    if (!parsed.success) {
        throw new AppError(
            parsed.error.issues[0]?.message || "Invalid roster import payload",
            "VALIDATION_ERROR",
            400,
        );
    }

    const results = {
        success: 0,
        failed: 0,
        errors: [] as string[],
    };

    for (const workerData of parsed.data) {
        try {
            if (
                workerData.phoneNumber &&
                !isValidPhoneNumber(workerData.phoneNumber)
            ) {
                throw new Error("Invalid phone number");
            }

            const resolvedRoles = resolveWorkerRoleSet({
                roles: workerData.roles,
                fallbackRole: workerData.jobTitle,
            });

            await db.insert(rosterEntry).values({
                id: nanoid(),
                organizationId: orgId,
                name: workerData.name,
                email: workerData.email.trim().toLowerCase(),
                phoneNumber: workerData.phoneNumber
                    ? normalizePhoneNumber(workerData.phoneNumber)
                    : null,
                role: workerData.role || "member",
                jobTitle: resolvedRoles[0] || workerData.jobTitle || null,
                roles: resolvedRoles,
                hourlyRate: workerData.hourlyRate || null,
                status: "uninvited",
            });

            results.success++;
        } catch (error: any) {
            results.failed++;
            results.errors.push(
                `Failed to import ${workerData.email}: ${error.message}`,
            );
        }
    }

    return results;
}

export async function getOrganizationInvitationState(invitationId: string) {
    return getBusinessInvitationState(invitationId);
}
