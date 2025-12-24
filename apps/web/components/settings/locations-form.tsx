import { useState } from "react";
import { Button } from "@repo/ui/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/ui/components/ui/dropdown-menu";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/ui/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, MapPin, Trash2, MoreVertical, Edit } from "lucide-react";
import { AddLocationModal } from "./add-location-modal";

type Location = {
    id: string;
    name: string;
    address: string | null;
    storeId?: string;
    parking?: string | null;
    specifics?: unknown; // Drizzle returns specialized type, safe to treat as unknown or string[] if we cast
    instructions?: string | null;
};

interface LocationsFormProps {
    locations: Location[];
    onDelete: (id: string) => Promise<{ error?: string }>;
    onAdd: (data: any) => Promise<{ error?: string }>;
    onUpdate: (id: string, data: any) => Promise<{ error?: string }>;
}

export function LocationsForm({ locations, onDelete, onAdd, onUpdate }: LocationsFormProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingLocation, setEditingLocation] = useState<Location | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleAddClick = () => {
        setEditingLocation(null);
        setIsModalOpen(true);
    };

    const handleEditClick = (loc: Location) => {
        setEditingLocation(loc);
        setIsModalOpen(true);
    };

    const handleSave = async (data: any) => {
        if (editingLocation) {
            return await onUpdate(editingLocation.id, data);
        } else {
            return await onAdd(data);
        }
    };

    const confirmDelete = async () => {
        if (!deletingId) return;
        try {
            const result = await onDelete(deletingId);
            if (result?.error) {
                toast.error(result.error);
            } else {
                toast.success("Location deleted.");
            }
        } catch (error) {
            toast.error("Failed to delete location.");
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <>
            <AddLocationModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                initialData={editingLocation ? {
                    name: editingLocation.name,
                    address: editingLocation.address || "",
                    parking: editingLocation.parking || "free",
                    specifics: (editingLocation.specifics as string[]) || [],
                    instructions: editingLocation.instructions || "",
                } : undefined}
                onSave={handleSave}
            />

            <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the location
                            and remove it from our servers.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                    <div className="space-y-1.5">
                        <CardTitle>Locations</CardTitle>
                        <CardDescription>Manage your business locations.</CardDescription>
                    </div>
                    <Button onClick={handleAddClick} size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Location
                    </Button>
                </CardHeader>
                <CardContent>
                    {locations.length === 0 ? (
                        <div className="text-center py-10 text-muted-foreground border-2 border-dashed rounded-lg">
                            No locations found. Add one to get started.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {locations.map((loc) => (
                                <div key={loc.id} className="flex items-center justify-between p-4 border rounded-lg bg-white">
                                    <div className="flex items-start gap-4">
                                        <div className="mt-1 bg-slate-100 p-2 rounded-full text-slate-600">
                                            <MapPin className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-900">{loc.name}</p>
                                            <p className="text-sm text-slate-500">{loc.address}</p>
                                            {loc.storeId && (
                                                <p className="text-xs text-slate-400 mt-1 font-mono">ID: {loc.storeId}</p>
                                            )}
                                        </div>
                                    </div>

                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreVertical className="h-4 w-4" />
                                                <span className="sr-only">Open menu</span>
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditClick(loc)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem
                                                className="text-red-600 focus:text-red-600"
                                                onClick={() => setDeletingId(loc.id)}
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
