import { Hono } from 'hono';
import { db } from '@repo/database';
import { shift, shiftAssignment, location } from '@repo/database/schema';
import { eq, and, gt, lt, asc, sql } from 'drizzle-orm';
import { auth } from '@repo/auth';
import { addHours } from 'date-fns';

const shifts = new Hono<{
    Variables: {
        user: typeof auth.$Infer.Session.user
    }
}>();

// Get upcoming shifts (next 48 hours)
shifts.get('/upcoming', async (c) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);

    const now = new Date();
    const futureLimit = addHours(now, 48);

    // Fetch assignments with shift and location relations
    // Using Drizzle Query API for ease of relation fetching if relations are defined, 
    // but explicit join is often safer if schema structure is complex.
    // Based on standard schema patterns:

    // We need: Shift ID, Start Time, End Time, Location (Lat, Lng, Radius)

    const upcomingAssignments = await db.select({
        assignmentId: shiftAssignment.id,
        shiftId: shift.id,
        title: shift.title,
        startTime: shift.startTime,
        endTime: shift.endTime,
        location: {
            id: location.id,
            name: location.name,
            latitude: sql<number>`ST_Y(${location.position}::geometry)`.mapWith(Number),
            longitude: sql<number>`ST_X(${location.position}::geometry)`.mapWith(Number),
            radius: location.geofenceRadius,
        }
    })
        .from(shiftAssignment)
        .innerJoin(shift, eq(shiftAssignment.shiftId, shift.id))
        .innerJoin(location, eq(shift.locationId, location.id))
        .where(and(
            eq(shiftAssignment.workerId, user.id),
            eq(shiftAssignment.status, 'active'), // Assuming 'active' is the confirmed status
            gt(shift.endTime, now),        // Ends in future
            lt(shift.startTime, futureLimit) // Starts soon
        ))
        .orderBy(asc(shift.startTime));

    return c.json({ shifts: upcomingAssignments });
});

export default shifts;
