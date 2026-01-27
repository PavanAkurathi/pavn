
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "@repo/database";
import Stripe from "stripe";

const getStripe = () => {
    const apiKey = process.env.STRIPE_SECRET_KEY || "sk_test_mock_key_for_build";
    if (!apiKey) {
        // This should theoretically be unreachable due to the fallback above, 
        // but ensures the type checker and runtime are happy.
        throw new Error("Stripe API Key is missing");
    }
    return new Stripe(apiKey, {
        apiVersion: "2025-12-15.clover" as any, // @ts-ignore - Beta version
        typescript: true,
    });
};

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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

        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Signature Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    try {
        switch (event.type) {
            // 1. Checkout Completed -> Link Sub to Org
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.subscription) {
                    const subscriptionId = typeof session.subscription === 'string'
                        ? session.subscription
                        : session.subscription.id;

                    const orgId = session.metadata?.orgId;

                    if (orgId && subscriptionId) {
                        await db.update(organization)
                            .set({
                                stripeSubscriptionId: subscriptionId,
                                subscriptionStatus: "active", // Assume active on creation
                                // Retrieve the subscription object to get current_period_end if needed,
                                // or wait for the 'customer.subscription.created' event which usually fires too.
                                // For immediate UX, "active" is good enough.
                            })
                            .where(eq(organization.id, orgId));
                        console.log(`[Webhook] Linked subscription ${subscriptionId} to org ${orgId}`);
                    }
                }
                break;
            }

            // 2. Subscription Created/Updated -> Sync Status & Period
            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const sub = event.data.object as Stripe.Subscription;
                const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

                // Find org by Stripe Customer ID
                const org = await db.query.organization.findFirst({
                    where: eq(organization.stripeCustomerId, customerId)
                });

                if (org) {
                    await db.update(organization)
                        .set({
                            stripeSubscriptionId: sub.id,
                            subscriptionStatus: sub.status,
                            currentPeriodEnd: new Date((sub as any).current_period_end * 1000)
                        })
                        .where(eq(organization.id, org.id));
                    console.log(`[Webhook] Synced subscription ${sub.id} for org ${org.id}. Status: ${sub.status}`);
                }
                break;
            }

            // 3. Subscription Deleted -> Set Inactive
            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription;
                const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

                const org = await db.query.organization.findFirst({
                    where: eq(organization.stripeCustomerId, customerId)
                });

                if (org) {
                    await db.update(organization)
                        .set({
                            subscriptionStatus: "inactive",
                            currentPeriodEnd: undefined, // Clear or keep as last known? Usually clear to avoid confusion.
                            stripeSubscriptionId: null
                        })
                        .where(eq(organization.id, org.id));
                    console.log(`[Webhook] Subscription ${sub.id} deleted. Marked org ${org.id} inactive.`);
                }
                break;
            }

            default:
            // console.log(`[Webhook] Unhandled event type ${event.type}`);
        }
    } catch (error) {
        // Return 200 anyway so Stripe doesn't retry infinitely on logic errors
        console.error("[Webhook] Handler Error:", error);
        return NextResponse.json({ received: true, error: "Logic Error" });
    }

    return NextResponse.json({ received: true });
}