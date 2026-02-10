
import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq } from "@repo/database";
import { nanoid } from "nanoid";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> } // params is a Promise in Next 15/latest
) {
    try {
        const { orgId } = await params;

        if (!orgId) {
            return new NextResponse("Organization ID missing", { status: 400 });
        }

        const locations = await db.query.location.findMany({
            where: eq(location.organizationId, orgId)
        });

        // Map to expected format if needed, or just return
        // Frontend expects: { id, name, address }
        // DB has: id, name, address, etc.
        return NextResponse.json(locations);

    } catch (error) {
        console.error("Error fetching locations:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> }
) {
    try {
        const { orgId } = await params;
        if (!orgId) {
            return new NextResponse("Organization ID missing", { status: 400 });
        }

        const body = await request.json();
        const { name, address, timezone } = body;

        if (!name || !address) {
            return new NextResponse("Name and Address are required", { status: 400 });
        }

        const now = new Date();
        const id = nanoid();
        // Simple slug generation
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + nanoid(4);

        const [newLocation] = await db.insert(location).values({
            id,
            organizationId: orgId,
            name,
            slug,
            address,
            timezone: timezone || "UTC",
            createdAt: now,
            updatedAt: now,
        }).returning();

        return NextResponse.json(newLocation);

    } catch (error) {
        console.error("Error creating location:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
