
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: "2025-12-15.clover" as any,
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(req: Request) {
    const body = await req.text();
    // Await headers() to get the ReadonlyHeaders object
    const headersList = await headers();
    const sig = headersList.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
        if (!sig || !endpointSecret) {
            console.error("Webhook Error: Missing signature or endpoint secret");
            return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
        }
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Signature Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                // Retrieve the subscription details
                if (session.subscription) {
                    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;

                    // We stored orgId in metadata during checkout creation
                    const orgId = session.metadata?.orgId;

                    if (orgId && subscriptionId) {
                        await db.update(organization)
                            .set({ stripeSubscriptionId: subscriptionId })
                            .where(eq(organization.id, orgId));
                        console.log(`[Webhook] Linked subscription ${subscriptionId} to org ${orgId}`);
                    }
                }
                break;
            }
            case "customer.subscription.updated": {
                // Good place to update status or expiration in DB if we were caching it
                // For now we fetch live status so this is less critical, but good for logs
                const sub = event.data.object as Stripe.Subscription;
                console.log(`[Webhook] Subscription updated: ${sub.id}, status: ${sub.status}`);
                break;
            }
            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription;
                // Find org with this subscription and remove it
                const org = await db.query.organization.findFirst({
                    where: eq(organization.stripeSubscriptionId, sub.id)
                });

                if (org) {
                    await db.update(organization)
                        .set({ stripeSubscriptionId: null })
                        .where(eq(organization.id, org.id));
                    console.log(`[Webhook] Subscription ${sub.id} deleted. Removed from org ${org.id}`);
                }
                break;
            }
            default:
                console.log(`[Webhook] Unhandled event type ${event.type}`);
        }
    } catch (error) {
        console.error("[Webhook] Handler Error:", error);
        return NextResponse.json({ error: "Handler Error" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}