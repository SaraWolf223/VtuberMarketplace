import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno';
import { createSupabaseAdmin } from '../_shared/supabaseAdmin.ts';
import {
  applyBoostFromPaymentIntent,
  recordWebhookEvent,
} from '../_shared/apply-boost.ts';
import {
  resetCreditsFromInvoice,
  syncPremiumFromSubscription,
} from '../_shared/apply-premium.ts';
import {
  markSupportQuotePaid,
  syncListingSupportSubscription,
} from '../_shared/apply-support-subscription.ts';
import {
  markOrderPaidFromCheckout,
  markOrderRefunded,
  syncConnectAccountFlags,
} from '../_shared/apply-order.ts';
import { syncProSellerFromSubscription } from '../_shared/apply-pro-seller.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Fail fast on misconfiguration instead of silently running with an empty key.
  const secretKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secretKey || !webhookSecret) {
    return new Response('Webhook not configured', { status: 503 });
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2024-11-20.acacia',
    httpClient: Stripe.createFetchHttpClient(),
  });

  const signature = req.headers.get('stripe-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 400 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch {
    return new Response('Invalid signature', { status: 400 });
  }

  const admin = createSupabaseAdmin();

  try {
    const isNew = await recordWebhookEvent(admin, event);
    if (!isNew) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (event.type === 'account.updated') {
      await syncConnectAccountFlags(admin, event.data.object as Stripe.Account);
    }

    if (
      event.type === 'payment_intent.succeeded' ||
      event.type === 'payment_intent.amount_capturable_updated'
    ) {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.type === 'boost_24h' && pi.id && event.type === 'payment_intent.succeeded') {
        await applyBoostFromPaymentIntent(admin, pi.id);
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === 'payment' && session.metadata?.type === 'order') {
        await markOrderPaidFromCheckout(admin, session);
      }
      if (
        session.mode === 'payment' &&
        session.metadata?.type === 'support_work_quote' &&
        session.metadata.quote_id
      ) {
        const pi =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        await markSupportQuotePaid(admin, session.metadata.quote_id, pi);
      }
      if (
        session.mode === 'payment' &&
        session.metadata?.type === 'featured_listing' &&
        session.metadata.listing_id &&
        session.metadata.user_id
      ) {
        const pi =
          typeof session.payment_intent === 'string'
            ? session.payment_intent
            : session.payment_intent?.id ?? null;
        await admin.rpc('apply_featured_placement', {
          p_user_id: session.metadata.user_id,
          p_listing_id: session.metadata.listing_id,
          p_source: 'paid',
          p_amount_cents: Number(session.metadata.amount_cents ?? 0) || 0,
          p_stripe_payment_intent_id: pi,
        });
      }
      if (session.mode === 'subscription' && session.subscription) {
        const subId =
          typeof session.subscription === 'string'
            ? session.subscription
            : session.subscription.id;
        const userId =
          session.client_reference_id ??
          session.metadata?.user_id ??
          null;
        let sub = await stripe.subscriptions.retrieve(subId);
        if (session.metadata?.type === 'listing_support_subscription') {
          await syncListingSupportSubscription(
            admin,
            sub,
            session.metadata.subscription_row_id
          );
        } else if (
          userId &&
          (session.metadata?.type === 'pro_seller' ||
            session.metadata?.type === 'premium_seller')
        ) {
          const metaType =
            session.metadata?.type === 'pro_seller' ? 'pro_seller' : 'premium_seller';
          if (!sub.metadata?.user_id || sub.metadata?.type !== metaType) {
            await stripe.subscriptions.update(subId, {
              metadata: {
                ...sub.metadata,
                type: metaType,
                user_id: userId,
              },
            });
            sub = await stripe.subscriptions.retrieve(subId);
          }
        }
        if (
          sub.metadata?.type === 'pro_seller' ||
          session.metadata?.type === 'pro_seller'
        ) {
          await syncProSellerFromSubscription(admin, sub, userId ?? undefined);
        } else if (
          sub.metadata?.type === 'premium_seller' ||
          session.metadata?.type === 'premium_seller'
        ) {
          await syncPremiumFromSubscription(admin, sub, userId ?? undefined);
          await syncProSellerFromSubscription(admin, sub, userId ?? undefined);
        }
      }
    }

    if (
      event.type === 'customer.subscription.created' ||
      event.type === 'customer.subscription.updated'
    ) {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata?.type === 'listing_support_subscription') {
        await syncListingSupportSubscription(admin, sub);
      } else if (sub.metadata?.type === 'pro_seller') {
        await syncProSellerFromSubscription(admin, sub);
      } else if (sub.metadata?.type === 'premium_seller') {
        await syncPremiumFromSubscription(admin, sub);
        await syncProSellerFromSubscription(admin, sub);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription;
      if (sub.metadata?.type === 'listing_support_subscription') {
        await syncListingSupportSubscription(admin, sub);
      } else if (sub.metadata?.type === 'pro_seller') {
        await syncProSellerFromSubscription(admin, sub);
      } else if (sub.metadata?.type === 'premium_seller') {
        await syncPremiumFromSubscription(admin, sub);
        await syncProSellerFromSubscription(admin, sub);
      }
    }

    if (event.type === 'charge.refunded') {
      const charge = event.data.object as Stripe.Charge;
      const paymentIntentId =
        typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : charge.payment_intent?.id ?? null;
      if (paymentIntentId) {
        await markOrderRefunded(admin, paymentIntentId);
      }
    }

    if (event.type === 'invoice.paid') {
      const invoice = event.data.object as Stripe.Invoice;
      if (invoice.subscription) {
        await resetCreditsFromInvoice(admin, invoice);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('stripe-webhook error', e);
    return new Response('Webhook handler failed', { status: 500 });
  }
});
