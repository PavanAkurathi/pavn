import { Button } from "@repo/ui/components/ui/button";
import Link from "next/link";
import { Construction } from "lucide-react";

export default function ConstructionPage({ title }: { title: string }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center px-4">
            <div className="p-4 bg-slate-100 rounded-full">
                <Construction className="w-12 h-12 text-slate-400" />
            </div>
            <div className="space-y-2">
                <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
                <p className="text-slate-500 max-w-md mx-auto">
                    We're still building this page. Check back soon for updates.
                </p>
            </div>
            <Link href="/">
                <Button variant="outline">Back to Home</Button>
            </Link>
        </div>
    );
}
