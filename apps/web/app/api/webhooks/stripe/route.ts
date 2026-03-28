
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { organization } from "@repo/database/schema";
import { eq } from "@repo/database";
import Stripe from "stripe";
import { requireStripe } from "@/lib/billing/stripe";

export const runtime = "nodejs";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

function toPeriodEndDate(unixSeconds?: number | null) {
    if (!unixSeconds) {
        return null;
    }

    return new Date(unixSeconds * 1000);
}

export async function POST(req: Request) {
    const body = await req.text();
    const headersList = await headers();
    const sig = headersList.get("stripe-signature")!;

    let event: Stripe.Event;

    try {
        if (!sig || !endpointSecret) {
            console.error("Webhook Error: Missing signature or endpoint secret");
            return NextResponse.json({ error: "Webhook Error" }, { status: 400 });
        }

        const stripe = requireStripe();
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Signature Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                if (session.subscription) {
                    const stripe = requireStripe();
                    const subscriptionId = typeof session.subscription === "string"
                        ? session.subscription
                        : session.subscription.id;
                    const orgId = session.metadata?.orgId;
                    const customerId = typeof session.customer === "string"
                        ? session.customer
                        : session.customer?.id ?? null;

                    if (orgId && subscriptionId) {
                        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

                        await db.update(organization)
                            .set({
                                stripeCustomerId: customerId,
                                stripeSubscriptionId: subscriptionId,
                                subscriptionStatus: subscription.status,
                                currentPeriodEnd: toPeriodEndDate((subscription as any).current_period_end),
                            })
                            .where(eq(organization.id, orgId));

                        console.log(`[Webhook] Linked subscription ${subscriptionId} to org ${orgId}`);
                    }
                }
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const sub = event.data.object as Stripe.Subscription;
                const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

                const org = await db.query.organization.findFirst({
                    where: eq(organization.stripeCustomerId, customerId),
                });

                if (org) {
                    await db.update(organization)
                        .set({
                            stripeCustomerId: customerId,
                            stripeSubscriptionId: sub.id,
                            subscriptionStatus: sub.status,
                            currentPeriodEnd: toPeriodEndDate((sub as any).current_period_end),
                        })
                        .where(eq(organization.id, org.id));
                    console.log(`[Webhook] Synced subscription ${sub.id} for org ${org.id}. Status: ${sub.status}`);
                }
                break;
            }

            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription;
                const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;

                const org = await db.query.organization.findFirst({
                    where: eq(organization.stripeCustomerId, customerId),
                });

                if (org) {
                    await db.update(organization)
                        .set({
                            stripeCustomerId: customerId,
                            subscriptionStatus: sub.status,
                            currentPeriodEnd: null,
                            stripeSubscriptionId: null,
                        })
                        .where(eq(organization.id, org.id));
                    console.log(`[Webhook] Subscription ${sub.id} deleted. Synced org ${org.id} to ${sub.status}.`);
                }
                break;
            }

            default:
        }
    } catch (error) {
        console.error("[Webhook] Handler Error:", error);
        return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
}
