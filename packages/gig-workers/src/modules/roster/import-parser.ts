import * as XLSX from "xlsx";
import { z } from "zod";
import { AppError } from "@repo/observability";
import { normalizeWorkerRoles } from "@repo/database";

const ImportRowSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().optional(),
    jobTitle: z.string().optional(),
    roles: z.array(z.string()).optional(),
    rate: z.number().min(0).optional(),
    role: z.enum(["admin", "manager", "member"]).default("member")
});

export type ImportRow = z.infer<typeof ImportRowSchema>;

export const parseWorkerFile = (fileBuffer: Buffer) => {
    let workbook;
    try {
        workbook = XLSX.read(fileBuffer, { type: "buffer" });
    } catch {
        throw new AppError("Invalid file format. Please upload a CSV or Excel file.", "INVALID_FILE", 400);
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new AppError("File is empty", "EMPTY_FILE", 400);

    const worksheet = workbook.Sheets[firstSheetName];
    if (!worksheet) {
        throw new AppError("Worksheet not found", "INVALID_FILE", 400);
    }

    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
        defval: ""
    });

    if (rawRows.length === 0) {
        throw new AppError("No data found in file", "EMPTY_DATA", 400);
    }

    const validRows: ImportRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    rawRows.forEach((row, index) => {
        const rowNum = index + 2;
        const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z]/g, "");

        const normalizedData: Record<string, unknown> = {};
        Object.keys(row).forEach((key) => {
            const cleanKey = normalizeKey(key);
            if (cleanKey.includes("email")) normalizedData.email = row[key];
            else if (cleanKey.includes("name") && !cleanKey.includes("user")) normalizedData.name = row[key];
            else if (cleanKey.includes("phone") || cleanKey.includes("mobile")) normalizedData.phone = row[key];
            else if (cleanKey.includes("primaryrole")) normalizedData.jobTitle = row[key];
            else if (cleanKey.includes("title") || cleanKey.includes("position") || cleanKey.includes("job")) normalizedData.jobTitle = row[key];
            else if (cleanKey.includes("roles") || cleanKey.includes("skills")) normalizedData.roles = normalizeWorkerRoles(String(row[key]));
            else if (cleanKey.includes("rate") || cleanKey.includes("pay") || cleanKey.includes("wage")) normalizedData.rate = row[key];
            else if (cleanKey.includes("role") || cleanKey.includes("access")) normalizedData.role = row[key];
        });

        if (typeof normalizedData.email === "string") {
            normalizedData.email = normalizedData.email.trim().toLowerCase();
        }

        if (normalizedData.rate) {
            const rateStr = String(normalizedData.rate).replace(/[^0-9.]/g, "");
            const rateFloat = parseFloat(rateStr);
            normalizedData.rate = Number.isNaN(rateFloat) ? 0 : Math.round(rateFloat * 100);
        }

        if (normalizedData.phone) {
            normalizedData.phone = String(normalizedData.phone).replace(/[^0-9+]/g, "");
        }

        const result = ImportRowSchema.safeParse(normalizedData);
        if (result.success) {
            validRows.push(result.data);
        } else {
            const issues = result.error.issues.map((issue) => issue.message).join(", ");
            errors.push({ row: rowNum, error: issues });
        }
    });

    return {
        success: errors.length === 0,
        data: validRows,
        errors,
        totalRows: rawRows.length
    };
};
