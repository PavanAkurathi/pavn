
import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/database";
import { member } from "@repo/database/schema";
import { eq } from "@repo/database";
import { memberRelations } from "@repo/database/schema"; // Ensure imports are correct

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        console.log("API: Fetching crew for org:", (await params).orgId);
        const { orgId } = await params;

        if (!orgId) {
            return new NextResponse("Organization ID missing", { status: 400 });
        }

        const members = await db.query.member.findMany({
            where: eq(member.organizationId, orgId),
            with: {
                user: true
            }
        });

        // Map to CrewMember format expected by use-crew-data
        const crew = members.map(m => ({
            id: m.userId,
            name: m.user.name,
            avatar: m.user.image || "",
            roles: ["server"], // Mock roles for now, or derive from m.role
            hours: 0,
            initials: m.user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
        }));

        return NextResponse.json(crew);

    } catch (error) {
        console.error("Error fetching crew:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
