"use client";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Separator } from "@repo/ui/components/ui/separator";
import { Mail, Phone, MapPin, AlertCircle, Calendar, Award } from "lucide-react";
import { format } from "date-fns";
import { AvailabilityList } from "./availability-list";

export interface WorkerDetails {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    phone?: string | null;
    role: string;
    jobTitle?: string | null;
    joinedAt: Date;
    status: "active" | "invited";
    emergencyContact?: {
        name: string;
        phone: string;
        relation: string;
    } | null;
    address?: {
        street: string;
        city: string;
        state: string;
        zip: string;
    } | null;
    certifications?: Array<{
        id: string;
        name: string;
        issuer?: string | null;
        expiresAt?: Date | null;
        status?: string | null;
    }>;
}

interface WorkerDetailsSheetProps {
    worker: WorkerDetails | null;
    isOpen: boolean;
    onClose: () => void;
}

export function WorkerDetailsSheet({ worker, isOpen, onClose }: WorkerDetailsSheetProps) {
    if (!worker) return null;

    return (
        <Sheet open={isOpen} onOpenChange={onClose}>
            <SheetContent className="w-[400px] sm:w-[540px] overflow-y-auto">
                <SheetHeader className="pb-6">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={worker.image || ""} />
                            <AvatarFallback className="text-lg">{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                            <SheetTitle className="text-xl">{worker.name}</SheetTitle>
                            <SheetDescription>
                                {worker.jobTitle || worker.role} • Joined {format(new Date(worker.joinedAt), "PP")}
                            </SheetDescription>
                            <div className="flex gap-2 mt-2">
                                {worker.status === "invited" && (
                                    <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
                                        Invited
                                    </Badge>
                                )}
                                <Badge variant="secondary" className="capitalize">
                                    {worker.role}
                                </Badge>
                            </div>
                        </div>
                    </div>
                </SheetHeader>

                <div className="space-y-6">
                    {/* Contact Info */}
                    <div>
                        <h4 className="text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">Contact Information</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="h-4 w-4 text-slate-500" />
                                <span>{worker.email}</span>
                            </div>
                            {worker.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Phone className="h-4 w-4 text-slate-500" />
                                    <span>{worker.phone}</span>
                                </div>
                            )}
                            {worker.address && (
                                <div className="flex items-start gap-3 text-sm">
                                    <MapPin className="h-4 w-4 text-slate-500 mt-0.5" />
                                    <span>
                                        {worker.address.street}<br />
                                        {worker.address.city}, {worker.address.state} {worker.address.zip}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Emergency Contact */}
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
                            <AlertCircle className="h-4 w-4" /> Emergency Contact
                        </h4>
                        {worker.emergencyContact ? (
                            <div className="bg-red-50 p-3 rounded-md border border-red-100 dark:bg-red-950/10 dark:border-red-900/20">
                                <p className="font-medium text-sm text-red-900 dark:text-red-200">{worker.emergencyContact.name}</p>
                                <div className="flex gap-4 mt-1 text-xs text-red-700 dark:text-red-400">
                                    <span>{worker.emergencyContact.relation}</span>
                                    <span>•</span>
                                    <span>{worker.emergencyContact.phone}</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No emergency contact on file.</p>
                        )}
                    </div>

                    <Separator />

                    {/* Certifications */}
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
                            <Award className="h-4 w-4" /> Certifications
                        </h4>
                        {worker.certifications && worker.certifications.length > 0 ? (
                            <div className="space-y-3">
                                {worker.certifications.map((cert) => (
                                    <div key={cert.id} className="flex items-center justify-between p-3 border rounded-md bg-slate-50/50">
                                        <div>
                                            <p className="font-medium text-sm">{cert.name}</p>
                                            <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                                        </div>
                                        {cert.expiresAt && (
                                            <div className="text-right">
                                                <Badge variant="outline" className={
                                                    new Date(cert.expiresAt) < new Date()
                                                        ? "text-red-600 border-red-200 bg-red-50"
                                                        : "text-green-600 border-green-200 bg-green-50"
                                                }>
                                                    {new Date(cert.expiresAt) < new Date() ? "Expired" : "Valid"}
                                                </Badge>
                                                <p className="text-[10px] text-muted-foreground mt-1">
                                                    Exp: {format(new Date(cert.expiresAt), "MMM yyyy")}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-muted-foreground italic">No certifications on file.</p>
                        )}

                    </div>

                    <Separator />

                    {/* Availability */}
                    <div>
                        <h4 className="flex items-center gap-2 text-sm font-medium mb-3 text-muted-foreground uppercase tracking-wider">
                            <Calendar className="h-4 w-4" /> Availability (Next 30 Days)
                        </h4>
                        <AvailabilityList workerId={worker.id} />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
