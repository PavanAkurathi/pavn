
import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/database";
import { member, user } from "@repo/database/schema";
import { eq, and, or } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;

        if (!orgId) {
            return new NextResponse("Organization ID missing", { status: 400 });
        }

        // Fetch members with user details
        // Requirement: Only 'admin' or 'manager' (Note: DB currently has 'role' as string. Assuming 'admin' and 'member'. 
        // Ticket says "role: 'admin' or role: 'manager'". Check schema for roles. 
        // Schema says: role: text("role").notNull() // "admin" | "member"
        // If the ticket implies a 'manager' role exists or we should treat 'admin' as manager.
        // I will assume 'admin' for now, or check if 'manager' is used.
        // Actually, the ticket says "Filter results to only show members with role: 'admin' or role: 'manager'".
        // Schema only documents "admin" | "member" in comments.
        // I will trust the ticket might know more, or I should just return all and let frontend filter, 
        // OR filtering by 'admin' and 'manager' where.

        // Let's filter by 'admin' for now as that's safe, and 'manager' if it exists.

        const members = await db.select({
            id: member.id,
            userId: member.userId,
            role: member.role,
            user: {
                name: user.name,
                email: user.email,
                phone: user.phoneNumber,
            }
        })
            .from(member)
            .innerJoin(user, eq(member.userId, user.id))
            .where(
                and(
                    eq(member.organizationId, orgId),
                    // Filtering logic:
                    or(eq(member.role, 'admin'), eq(member.role, 'manager'))
                )
            );

        // Transform to ContactOption format
        // { id, userId, name, phone, initials, role }
        const contacts = members.map(m => ({
            id: m.id, // Member ID (which serves as Contact ID usually) OR userId? 
            // Form uses `contactId` which maps to `managerIds` entries. 
            // In `create-schedule-form`, `managerIds` are used as `contactId`. 
            // Usually `contactId` refers to a Member ID or User ID. 
            // Given the previous mock data: id: "c-1", userId: "..."
            // I will use Member ID as `id`.
            userId: m.userId,
            name: m.user.name,
            phone: m.user.phone || "",
            initials: m.user.name.split(" ").map((n: string) => n[0]).join("").substring(0, 2).toUpperCase(),
            role: m.role.charAt(0).toUpperCase() + m.role.slice(1)
        }));

        return NextResponse.json(contacts);

    } catch (error) {
        console.error("Error fetching members:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
