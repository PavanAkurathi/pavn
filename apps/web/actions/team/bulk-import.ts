"use server";

import {
    BulkImportWorkersInputSchema,
    type BulkImportWorker,
    type BulkImportWorkersResult,
} from "@repo/contracts/workforce";
import { revalidatePath } from "next/cache";
import { apiJsonRequest } from "@/lib/server/api-client";

export async function bulkImport(
    rawWorkers: BulkImportWorker[],
): Promise<BulkImportWorkersResult> {
    const parsed = BulkImportWorkersInputSchema.safeParse(rawWorkers);
    if (!parsed.success) {
        throw new Error("Invalid input data: " + parsed.error.message);
    }

    const result = await apiJsonRequest<BulkImportWorkersResult>(
        "/organizations/crew/import",
        {
            method: "POST",
            body: parsed.data,
            organizationScoped: true,
        },
    );

    revalidatePath("/settings/team");
    revalidatePath("/rosters");
    return result;
}
