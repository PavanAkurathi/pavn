import type { ReactNode } from "react";

/**
 * The bar across the top of a page in the signed-in app: a title, one line
 * under it, and whatever belongs on the right. The Scheduler has its own
 * toolbar; Team and Requests use this.
 */
export function PageTopBar({
    title,
    subtitle,
    actions,
}: {
    title: string;
    subtitle?: ReactNode;
    actions?: ReactNode;
}) {
    return (
        <div className="flex flex-wrap items-center gap-2.5 border-b bg-card px-3.5 py-2.5">
            <div>
                <h1 className="text-[15px] font-bold leading-tight tracking-tight">{title}</h1>
                {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
            </div>
            {actions ? <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
    );
}
