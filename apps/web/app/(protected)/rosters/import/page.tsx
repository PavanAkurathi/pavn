"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@repo/ui/components/ui/table";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import { Upload, X, Check, FileSpreadsheet, Loader2, AlertTriangle, ArrowLeft } from "lucide-react";
import { bulkImport } from "@/actions/team";
import Link from "next/link";
import { cn } from "@repo/ui/lib/utils";

interface WorkerRow {
    id: string; // Internal ID for tracking edits
    name: string;
    email: string;
    phone: string;
    role: "member";
    hourlyRate: string;
    jobTitle: string;
    // Profile Extensions
    image: string;
    emergencyName: string;
    emergencyPhone: string;
    certName: string;
    certExpiry: string;
    isValid: boolean;
    errors: string[];
}

export default function BulkImportPage() {
    const router = useRouter();
    const [step, setStep] = useState<"upload" | "review" | "success">("upload");
    const [rows, setRows] = useState<WorkerRow[]>([]);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [importStats, setImportStats] = useState({ success: 0, failed: 0, errors: [] as string[] });

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            setFile(selectedFile);
            parseFile(selectedFile);
        }
    };

    const parseFile = (file: File) => {
        const reader = new FileReader();

        if (file.name.endsWith(".csv")) {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => processRawData(results.data),
            });
        } else {
            reader.onload = (e) => {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: "binary" });
                const sheetName = workbook.SheetNames[0];
                if (!sheetName) {
                    toast.error("No sheets found in Excel file");
                    return;
                }
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) {
                    toast.error("Invalid sheet data");
                    return;
                }
                const json = XLSX.utils.sheet_to_json(sheet);
                processRawData(json);
            };
            reader.readAsBinaryString(file);
        }
    };

    const processRawData = (data: any[]) => {
        const processed: WorkerRow[] = data.map((row: any, index) => {
            const rowData = normalizeRow(row);
            const validation = validateRow(rowData);
            return {
                id: crypto.randomUUID(),
                ...rowData,
                isValid: validation.valid,
                errors: validation.errors
            };
        });
        setRows(processed);
        setStep("review");
    };

    // Heuristics to map columns (Dirty Data Handling)
    const normalizeRow = (row: any) => {
        const keys = Object.keys(row).map(k => k.toLowerCase());
        const getValue = (keyPart: string) => {
            const match = Object.keys(row).find(k => k.toLowerCase().includes(keyPart));
            return match ? String(row[match]).trim() : "";
        };

        return {
            name: getValue("name") || getValue("worker") || getValue("employee"),
            email: getValue("email") || getValue("e-mail") || getValue("mail"),
            phone: getValue("phone") || getValue("mobile") || getValue("cell"),
            role: "member" as const,
            hourlyRate: getValue("rate") || getValue("hourly") || getValue("pay"),
            jobTitle: getValue("title") || getValue("job") || getValue("position"),
            // Profile Extensions
            image: getValue("avatar") || getValue("image") || getValue("photo") || getValue("picture"),
            emergencyName: getValue("emergency name") || getValue("contact name") || getValue("ice name"),
            emergencyPhone: getValue("emergency phone") || getValue("contact phone") || getValue("ice phone"),
            certName: getValue("cert") || getValue("license") || getValue("certification"),
            certExpiry: getValue("expire") || getValue("valid until") || getValue("valid to")
        };
    };

    const validateRow = (row: { name: string; email: string }) => {
        const errors: string[] = [];
        if (!row.name) errors.push("Missing Name");
        if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errors.push("Invalid Email");
        return { valid: errors.length === 0, errors };
    };

    const updateRow = (id: string, field: keyof WorkerRow, value: string) => {
        setRows(current => current.map(row => {
            if (row.id === id) {
                const updated = { ...row, [field]: value };
                const validation = validateRow(updated);
                // @ts-ignore - Dynamic key update
                return { ...updated, isValid: validation.valid, errors: validation.errors };
            }
            return row;
        }));
    };

    const removeRow = (id: string) => {
        setRows(current => current.filter(r => r.id !== id));
    };

    const handleImport = async () => {
        setLoading(true);
        const validRows = rows.filter(r => r.isValid);

        if (validRows.length === 0) {
            toast.error("No valid rows to import.");
            setLoading(false);
            return;
        }

        try {
            const payload = validRows.map(r => ({
                name: r.name,
                email: r.email,
                phoneNumber: r.phone || undefined,
                role: r.role,
                hourlyRate: r.hourlyRate ? Math.round(parseFloat(r.hourlyRate.replace(/[^0-9.]/g, '')) * 100) : undefined,
                jobTitle: r.jobTitle || undefined,
                image: r.image || undefined,
                emergencyContact: (r.emergencyName || r.emergencyPhone) ? {
                    name: r.emergencyName || "",
                    phone: r.emergencyPhone || "",
                    relation: "Emergency Contact" // Defaulting since simple import usually lacks relation
                } : undefined,
                certifications: r.certName ? [{
                    name: r.certName,
                    issuer: "External Import",
                    expiresAt: r.certExpiry ? new Date(r.certExpiry) : new Date(new Date().setFullYear(new Date().getFullYear() + 1)) // Default 1 year if not parsed
                }] : undefined
            }));

            const result = await bulkImport(payload);
            setImportStats(result);
            setStep("success");
            toast.success(`Imported ${result.success} workers.`);
        } catch (error) {
            toast.error("Bulk import failed.");
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container max-w-5xl py-8 space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href="/rosters"><ArrowLeft className="h-4 w-4" /></Link>
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Bulk Import Workers</h1>
                    <p className="text-muted-foreground">Upload a CSV or Excel file to add users in bulk.</p>
                </div>
            </div>

            {step === "upload" && (
                <Card className="border-dashed border-2 py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="bg-slate-100 p-4 rounded-full">
                        <FileSpreadsheet className="h-8 w-8 text-slate-500" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-semibold text-lg">Upload your roster</h3>
                        <p className="text-sm text-muted-foreground">Drag and drop or click to browse (CSV, XLSX)</p>
                    </div>
                    <div className="relative">
                        <input
                            type="file"
                            accept=".csv, .xlsx, .xls"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFile}
                        />
                        <Button>Select File</Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-4">
                        Supported columns: Name, Email, Phone, Hourly Rate, Job Title
                    </p>
                </Card>
            )}

            {step === "review" && (
                <div className="space-y-4">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <div>
                                <CardTitle>Review Data</CardTitle>
                                <CardDescription>
                                    Found {rows.length} rows. {rows.filter(r => !r.isValid).length} need attention.
                                    Click any cell to edit.
                                </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="ghost" onClick={() => setStep("upload")}>Cancel</Button>
                                <Button onClick={handleImport} disabled={loading || rows.filter(r => r.isValid).length === 0}>
                                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Import {rows.filter(r => r.isValid).length} Valid Workers
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="border-t max-h-[600px] overflow-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[80px]">Status</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Email</TableHead>
                                            <TableHead>Phone</TableHead>
                                            <TableHead>Rate ($)</TableHead>
                                            <TableHead>Title</TableHead>
                                            <TableHead>Emergency</TableHead>
                                            <TableHead>Cert</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((row) => (
                                            <TableRow key={row.id} className={cn(!row.isValid && "bg-red-50 hover:bg-red-100")}>
                                                <TableCell>
                                                    {row.isValid ? (
                                                        <Check className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <div className="flex items-center gap-1 text-red-500" title={row.errors.join(", ")}>
                                                            <AlertTriangle className="h-4 w-4" />
                                                        </div>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className={cn("h-8 bg-transparent border-transparent hover:border-input focus:bg-background", !row.name && "border-red-300")}
                                                        value={row.name}
                                                        onChange={(e) => updateRow(row.id, "name", e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className={cn("h-8 bg-transparent border-transparent hover:border-input focus:bg-background", (!row.email || row.errors.includes("Invalid Email")) && "border-red-300")}
                                                        value={row.email}
                                                        onChange={(e) => updateRow(row.id, "email", e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className="h-8 bg-transparent border-transparent hover:border-input focus:bg-background"
                                                        value={row.phone}
                                                        onChange={(e) => updateRow(row.id, "phone", e.target.value)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className="h-8 w-20 bg-transparent border-transparent hover:border-input focus:bg-background"
                                                        value={row.hourlyRate}
                                                        onChange={(e) => updateRow(row.id, "hourlyRate", e.target.value)}
                                                        placeholder="25.00"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className="h-8 bg-transparent border-transparent hover:border-input focus:bg-background"
                                                        value={row.jobTitle}
                                                        onChange={(e) => updateRow(row.id, "jobTitle", e.target.value)}
                                                        placeholder="Guard"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className="h-8 bg-transparent border-transparent hover:border-input focus:bg-background"
                                                        value={row.emergencyName}
                                                        onChange={(e) => updateRow(row.id, "emergencyName", e.target.value)}
                                                        placeholder="Contact Name"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        className="h-8 bg-transparent border-transparent hover:border-input focus:bg-background"
                                                        value={row.certName}
                                                        onChange={(e) => updateRow(row.id, "certName", e.target.value)}
                                                        placeholder="Cert Name"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500" onClick={() => removeRow(row.id)}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {step === "success" && (
                <div className="flex flex-col items-center justify-center space-y-4 py-12">
                    <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center">
                        <Check className="h-8 w-8" />
                    </div>
                    <h2 className="text-2xl font-bold">Import Complete!</h2>
                    <p className="text-center text-muted-foreground">
                        Successfully added {importStats.success} workers.<br />
                        {importStats.failed > 0 && <span className="text-red-500">Failed to add {importStats.failed} workers.</span>}
                    </p>

                    {importStats.errors.length > 0 && (
                        <Card className="w-full max-w-lg mt-4">
                            <CardHeader><CardTitle className="text-base">Errors</CardTitle></CardHeader>
                            <CardContent>
                                <ul className="list-disc list-inside text-sm text-red-500 space-y-1">
                                    {importStats.errors.map((err, i) => <li key={i}>{err}</li>)}
                                </ul>
                            </CardContent>
                        </Card>
                    )}

                    <Button onClick={() => router.push("/rosters")}>
                        Back to Roster
                    </Button>
                </div>
            )}
        </div>
    );
}
