import { db } from "@repo/database";
import { worker } from "@repo/database/schema";
import { and, eq } from "drizzle-orm";
import { ImportRow } from "./import-parser";
import { createWorker, findWorkerByPhone, parseWorkerPhone } from "./create-worker";
import { updateWorker } from "./update-worker";

/**
 * Puts imported people on the list. Nobody is invited: the manager reviews the
 * list first and invites from there. Rows are matched by phone number (then
 * email) so importing the same sheet twice doesn't duplicate anyone.
 */
export const bulkImportWorkers = async (orgId: string, rows: ImportRow[]) => {
    const results = { created: 0, updated: 0, failed: 0, errors: [] as string[] };

    for (const row of rows) {
        try {
            const phoneNumber = parseWorkerPhone(row.phone);
            const fields = {
                name: row.name,
                phoneNumber,
                email: row.email,
                jobTitle: row.jobTitle,
                roles: row.roles,
                hourlyRate: row.rate,
            };

            const byPhone = phoneNumber ? await findWorkerByPhone(orgId, phoneNumber) : null;
            const byEmail = !byPhone && row.email
                ? await db.query.worker.findFirst({
                    where: and(
                        eq(worker.organizationId, orgId),
                        eq(worker.email, row.email.toLowerCase()),
                    ),
                })
                : null;
            const existing = byPhone ?? byEmail;

            if (existing) {
                await updateWorker(fields, existing.id, orgId);
                results.updated++;
            } else {
                await createWorker(orgId, fields);
                results.created++;
            }
        } catch (error) {
            results.failed++;
            results.errors.push(`${row.name}: ${error instanceof Error ? error.message : "Could not import"}`);
        }
    }

    return results;
};
