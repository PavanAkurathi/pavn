import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/database";
import { member, workerRole } from "@repo/database/schema";
import { and, eq, ne } from "@repo/database";
import { deriveCrewRoles } from "@/lib/schedule/roles";

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0] || "")
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;

        if (!orgId) {
            return new NextResponse("Organization ID missing", { status: 400 });
        }

        const [members, explicitRoles] = await Promise.all([
            db.query.member.findMany({
                where: and(
                    eq(member.organizationId, orgId),
                    ne(member.role, "owner"),
                    ne(member.role, "admin")
                ),
                with: {
                    user: true,
                },
            }),
            db.query.workerRole.findMany({
                where: eq(workerRole.organizationId, orgId),
                columns: {
                    workerId: true,
                    role: true,
                },
            }),
        ]);

        const rolesByWorker = new Map<string, string[]>();
        for (const role of explicitRoles) {
            const list = rolesByWorker.get(role.workerId) || [];
            list.push(role.role);
            rolesByWorker.set(role.workerId, list);
        }

        const crew = members
            .filter((entry) => entry.user)
            .map((entry) => {
                const resolvedUser = entry.user!;
                return {
                    id: entry.userId,
                    name: resolvedUser.name,
                    avatar: resolvedUser.image || "",
                    roles: deriveCrewRoles(
                        rolesByWorker.get(entry.userId) || [],
                        entry.jobTitle || null
                    ),
                    hours: 0,
                    initials: getInitials(resolvedUser.name),
                };
            });

        return NextResponse.json(crew);
    } catch (error) {
        console.error("Error fetching crew:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
