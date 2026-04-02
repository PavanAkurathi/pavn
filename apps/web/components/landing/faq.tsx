'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@repo/ui/components/ui/accordion";
import { SUBSCRIPTION } from "@repo/config";

export function FAQ() {
    return (
        <section className="py-24 bg-muted/30 border-t border-border">
            <div className="container mx-auto px-6 max-w-3xl">
                <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Frequently Asked Questions</h2>

                <Accordion type="single" collapsible className="w-full space-y-4">

                    <AccordionItem value="item-1" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">Is it really unlimited staff for ${SUBSCRIPTION.MONTHLY_PRICE_USD}?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            Yes. Whether you have 5 workers or 500, the price is ${SUBSCRIPTION.MONTHLY_PRICE_USD}/month per location. We believe scheduling software should not tax your growth.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-2" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">Can I manage multiple locations?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            Yes. You can manage multiple locations from one business setup. Each location is billed separately at the same flat rate.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">Is there a contract?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            No contracts. Workers Hive is a month-to-month subscription. You can cancel at any time instantly from your dashboard.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-4" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">How does geofenced attendance work?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            You set a radius around the work location. Workers must enable GPS permissions on the app to clock in, and out-of-range activity can be reviewed before the shift is finalized.
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </div>
        </section>
    )
}
