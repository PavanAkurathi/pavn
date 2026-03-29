
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import {
    clearOrganizationSubscriptionByCustomerId,
    requireStripe,
    syncOrganizationSubscriptionByCustomerId,
    syncOrganizationSubscriptionFromCheckoutCompletion,
} from "@repo/billing";
import Stripe from "stripe";

export const runtime = "nodejs";

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
                        await syncOrganizationSubscriptionFromCheckoutCompletion({
                            orgId,
                            customerId,
                            subscriptionId,
                        });

                        console.log(`[Webhook] Linked subscription ${subscriptionId} to org ${orgId}`);
                    }
                }
                break;
            }

            case "customer.subscription.created":
            case "customer.subscription.updated": {
                const sub = event.data.object as Stripe.Subscription;
                const orgId = await syncOrganizationSubscriptionByCustomerId(sub);

                if (orgId) {
                    console.log(`[Webhook] Synced subscription ${sub.id} for org ${orgId}. Status: ${sub.status}`);
                }
                break;
            }

            case "customer.subscription.deleted": {
                const sub = event.data.object as Stripe.Subscription;
                const orgId = await clearOrganizationSubscriptionByCustomerId(sub);

                if (orgId) {
                    console.log(`[Webhook] Subscription ${sub.id} deleted. Synced org ${orgId} to ${sub.status}.`);
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
