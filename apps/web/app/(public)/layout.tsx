import { PublicHeader } from "@/components/layout/public-header";
import { PublicFooter } from "@/components/layout/public-footer";

export default function PublicLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <>
            <PublicHeader />
            <main className="grow pt-20">
                {children}
            </main>
            <PublicFooter />
        </>
    );
}
