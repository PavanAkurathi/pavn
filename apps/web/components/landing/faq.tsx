'use client';

import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@repo/ui/components/ui/accordion"

export function FAQ() {
    return (
        <section className="py-24 bg-muted/30 border-t border-border">
            <div className="container mx-auto px-6 max-w-3xl">
                <h2 className="text-3xl font-bold text-center mb-12 text-foreground">Frequently Asked Questions</h2>

                <Accordion type="single" collapsible className="w-full space-y-4">

                    <AccordionItem value="item-1" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">Is it really unlimited staff for $20?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            Yes. Whether you have 5 employees or 500, the price is $20/month per location. We believe software shouldn't tax your growth.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-2" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">Does it integrate with my Payroll?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            We provide 1-click CSV exports formatted for all major payroll providers (ADP, Gusto, Paychex, QuickBooks). Direct API integrations are coming in Phase 2.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-3" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">Is there a contract?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            No contracts. Workers Hive is a month-to-month subscription. You can cancel at any time instantly from your dashboard.
                        </AccordionContent>
                    </AccordionItem>

                    <AccordionItem value="item-4" className="border border-border bg-card rounded-lg px-4">
                        <AccordionTrigger className="text-lg font-medium text-card-foreground">How does the Geofencing work?</AccordionTrigger>
                        <AccordionContent className="text-muted-foreground pb-4">
                            You set a radius (e.g., 200 meters) around your venue. Workers must enable GPS permissions on the app to clock in. If they aren't on site, the button is disabled.
                        </AccordionContent>
                    </AccordionItem>

                </Accordion>
            </div>
        </section>
    )
}
