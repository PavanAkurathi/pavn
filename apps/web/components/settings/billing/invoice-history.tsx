// apps/web/components/settings/billing/invoice-history.tsx

"use client";

import { Card, CardContent } from "@repo/ui/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui/components/ui/table";
import { Badge } from "@repo/ui/components/ui/badge";
import { Button } from "@repo/ui/components/ui/button";
import { Download } from "lucide-react";

export interface InvoiceItem {
    id: string;
    date: string;
    amount: string;
    status: "paid" | "refunded" | "open" | "void" | "uncollectible";
    invoiceUrl?: string | null;
    description?: string;
}

export function InvoiceHistory({ invoices }: { invoices: InvoiceItem[] }) {
    if (!invoices || invoices.length === 0) return null;

    return (
        <Card className="border-slate-200">
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="pl-6">Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right pr-6">Receipt</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {invoices.map((inv) => (
                            <TableRow key={inv.id}>
                                <TableCell className="pl-6 text-muted-foreground">{inv.date}</TableCell>
                                <TableCell className="font-medium">{inv.amount}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="capitalize bg-green-50 text-green-700 border-green-200">
                                        {inv.status}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    {inv.invoiceUrl && (
                                        <Button variant="ghost" size="sm" onClick={() => window.open(inv.invoiceUrl!, "_blank")}>
                                            <Download className="h-4 w-4 mr-2" /> PDF
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}