import * as XLSX from 'xlsx';
import { z } from 'zod';
import { AppError } from '@repo/observability';

// Validation Schema for a single row
const ImportRowSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Invalid email format"),
    phone: z.string().optional(), // We will normalize this later
    jobTitle: z.string().optional(),
    rate: z.number().min(0).optional(), // We expect processed numbers (cents)
    role: z.enum(['admin', 'manager', 'member']).default('member')
});

export type ImportRow = z.infer<typeof ImportRowSchema>;

export const parseWorkerFile = (fileBuffer: Buffer) => {
    // 1. Read Workbook
    let workbook;
    try {
        workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    } catch (e) {
        throw new AppError("Invalid file format. Please upload a CSV or Excel file.", "INVALID_FILE", 400);
    }

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) throw new AppError("File is empty", "EMPTY_FILE", 400);

    const worksheet = workbook.Sheets[firstSheetName];

    if (!worksheet) {
        throw new AppError("Worksheet not found", "INVALID_FILE", 400);
    }

    // 2. Convert to JSON with Header mapping
    // We treat the first row as headers.
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, {
        defval: "" // Default empty cells to empty string
    });

    if (rawRows.length === 0) {
        throw new AppError("No data found in file", "EMPTY_DATA", 400);
    }

    const validRows: ImportRow[] = [];
    const errors: Array<{ row: number; error: string }> = [];

    // 3. Normalize & Validate Rows
    rawRows.forEach((row, index) => {
        const rowNum = index + 2; // +1 for header, +1 for 0-index

        // Heuristic Header Mapping (fuzzy match)
        // Users might write "Email Address" or "e-mail" or "Hourly Rate ($)"
        const normalizeKey = (k: string) => k.toLowerCase().replace(/[^a-z]/g, '');

        const normalizedData: any = {};
        Object.keys(row).forEach(key => {
            const cleanKey = normalizeKey(key);
            if (cleanKey.includes('email')) normalizedData.email = row[key];
            else if (cleanKey.includes('name') && !cleanKey.includes('user')) normalizedData.name = row[key];
            else if (cleanKey.includes('phone') || cleanKey.includes('mobile')) normalizedData.phone = row[key];
            else if (cleanKey.includes('title') || cleanKey.includes('position') || cleanKey.includes('job')) normalizedData.jobTitle = row[key];
            else if (cleanKey.includes('rate') || cleanKey.includes('pay') || cleanKey.includes('wage')) normalizedData.rate = row[key];
            else if (cleanKey.includes('role') || cleanKey.includes('access')) normalizedData.role = row[key];
        });

        // Data Cleaning
        if (typeof normalizedData.email === 'string') {
            normalizedData.email = normalizedData.email.trim().toLowerCase();
        }

        // Rate Parsing: "$15.50" -> 1550 cents
        if (normalizedData.rate) {
            let rateStr = String(normalizedData.rate).replace(/[^0-9.]/g, ''); // Remove '$'
            const rateFloat = parseFloat(rateStr);
            if (!isNaN(rateFloat)) {
                normalizedData.rate = Math.round(rateFloat * 100); // Convert to Cents
            } else {
                normalizedData.rate = 0;
            }
        }

        // Phone Normalization (Basic E.164 strip)
        if (normalizedData.phone) {
            normalizedData.phone = String(normalizedData.phone).replace(/[^0-9+]/g, '');
        }

        // Zod Validation
        const result = ImportRowSchema.safeParse(normalizedData);

        if (result.success) {
            validRows.push(result.data);
        } else {
            // Collect error for this row
            const issues = result.error.issues.map(i => i.message).join(", ");
            errors.push({ row: rowNum, error: issues });
        }
    });

    return {
        success: errors.length === 0,
        data: validRows,
        errors: errors,
        totalRows: rawRows.length
    };
};
