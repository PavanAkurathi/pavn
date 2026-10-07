import type { CrewMember } from "@repo/contracts/workforce";
import { worker } from "@repo/database/schema";
import { getInitials } from "../../utils/formatting";
import { deriveCrewRoles } from "../../utils/crew-roles";

type WorkerRow = typeof worker.$inferSelect;

export function toCrewMember(row: WorkerRow): CrewMember {
    const roles = deriveCrewRoles(row.roles ?? [], row.jobTitle);

    return {
        id: row.id,
        name: row.name,
        email: row.email,
        phone: row.phoneNumber,
        image: null,
        avatar: null,
        role: roles[0],
        roles,
        jobTitle: row.jobTitle,
        status: row.status as CrewMember["status"],
        initials: getInitials(row.name),
        hours: 0,
        employmentType: row.employmentType as CrewMember["employmentType"],
        agency: row.agency,
        hourlyRate: row.hourlyRate,
        hasAccount: row.userId !== null,
        // On the list and told about the app, but hasn't signed in yet.
        invitePending: row.userId === null && row.status === "invited",
        joinedAt: row.createdAt.toISOString(),
    };
}
