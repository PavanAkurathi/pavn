import type { ReactNode } from "react";

import { Card } from "heroui-native/card";

type SectionCardProps = {
    children: ReactNode;
    variant?: "default" | "secondary" | "tertiary";
    className?: string;
};

export function SectionCard({
    children,
    variant = "default",
    className,
}: SectionCardProps) {
    return (
        <Card variant={variant} className={["rounded-[28px]", className].filter(Boolean).join(" ")}>
            <Card.Body className="gap-4 p-5">{children}</Card.Body>
        </Card>
    );
}
