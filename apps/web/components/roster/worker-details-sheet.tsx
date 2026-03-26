"use client";

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@repo/ui/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@repo/ui/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@repo/ui/components/ui/avatar";
import { Badge } from "@repo/ui/components/ui/badge";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@repo/ui/components/ui/empty";
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
                        <Avatar className="size-16">
                            <AvatarImage src={worker.image || ""} />
                            <AvatarFallback className="text-lg">{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-2">
                            <SheetTitle className="text-xl">{worker.name}</SheetTitle>
                            <SheetDescription>
                                {worker.jobTitle || worker.role} • Joined {format(new Date(worker.joinedAt), "PP")}
                            </SheetDescription>
                            <div className="flex gap-2">
                                {worker.status === "invited" && (
                                    <Badge variant="outline">
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

                <div className="flex flex-col gap-6">
                    {/* Contact Info */}
                    <div className="flex flex-col gap-3">
                        <h4 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Contact Information</h4>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-3 text-sm">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{worker.email}</span>
                            </div>
                            {worker.phone && (
                                <div className="flex items-center gap-3 text-sm">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <span>{worker.phone}</span>
                                </div>
                            )}
                            {worker.address && (
                                <div className="flex items-start gap-3 text-sm">
                                    <MapPin className="mt-0.5 h-4 w-4 text-muted-foreground" />
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
                    <div className="flex flex-col gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                            <AlertCircle className="h-4 w-4" /> Emergency Contact
                        </h4>
                        {worker.emergencyContact ? (
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>{worker.emergencyContact.name}</AlertTitle>
                                <AlertDescription>
                                    {worker.emergencyContact.relation} • {worker.emergencyContact.phone}
                                </AlertDescription>
                            </Alert>
                        ) : (
                            <Empty className="rounded-md border border-dashed p-4">
                                <EmptyHeader className="max-w-none items-start text-left">
                                    <EmptyMedia variant="icon">
                                        <AlertCircle />
                                    </EmptyMedia>
                                    <EmptyTitle>No emergency contact</EmptyTitle>
                                    <EmptyDescription>No emergency contact is on file for this worker.</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}
                    </div>

                    <Separator />

                    {/* Certifications */}
                    <div className="flex flex-col gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                            <Award className="h-4 w-4" /> Certifications
                        </h4>
                        {worker.certifications && worker.certifications.length > 0 ? (
                            <div className="flex flex-col gap-3">
                                {worker.certifications.map((cert) => (
                                    <div key={cert.id} className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                                        <div>
                                            <p className="font-medium text-sm">{cert.name}</p>
                                            <p className="text-xs text-muted-foreground">{cert.issuer}</p>
                                        </div>
                                        {cert.expiresAt && (
                                            <div className="text-right">
                                                <Badge variant={new Date(cert.expiresAt) < new Date() ? "destructive" : "secondary"}>
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
                            <Empty className="rounded-md border border-dashed p-4">
                                <EmptyHeader className="max-w-none items-start text-left">
                                    <EmptyMedia variant="icon">
                                        <Award />
                                    </EmptyMedia>
                                    <EmptyTitle>No certifications</EmptyTitle>
                                    <EmptyDescription>No certifications are on file for this worker.</EmptyDescription>
                                </EmptyHeader>
                            </Empty>
                        )}

                    </div>

                    <Separator />

                    {/* Availability */}
                    <div className="flex flex-col gap-3">
                        <h4 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-muted-foreground">
                            <Calendar className="h-4 w-4" /> Availability (Next 30 Days)
                        </h4>
                        <AvailabilityList workerId={worker.id} />
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
