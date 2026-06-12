/**
 * Cloudflare Pages Function — Stripe Checkout Session
 * POST /api/checkout
 * Body: { priceId, memberId, email, successUrl, cancelUrl }
 *
 * Creates a Stripe Checkout session for member payments.
 * Uses existing Stripe account: acct_1T78EAA95N4c0ts1
 *
 * Environment variable required: STRIPE_SECRET_KEY
 */

export async function onRequestPost(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  try {
    const data = await context.request.json();
    const stripeKey = context.env?.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'Stripe not configured' }), { status: 500, headers: cors });
    }

    if (!data.priceId) {
      return new Response(JSON.stringify({ error: 'Missing priceId' }), { status: 400, headers: cors });
    }

    const origin = new URL(context.request.url).origin;
    const successUrl = data.successUrl || origin + '/?payment=success';
    const cancelUrl = data.cancelUrl || origin + '/?payment=cancelled';

    // Build Stripe Checkout Session
    const params = new URLSearchParams();
    params.append('mode', 'subscription');
    params.append('line_items[0][price]', data.priceId);
    params.append('line_items[0][quantity]', '1');
    params.append('success_url', successUrl);
    params.append('cancel_url', cancelUrl);

    if (data.email) {
      params.append('customer_email', data.email);
    }

    if (data.memberId) {
      params.append('client_reference_id', data.memberId);
      params.append('metadata[member_id]', data.memberId);
    }

    params.append('metadata[source]', 'hirecar-portal');

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const session = await stripeRes.json();

    if (!stripeRes.ok) {
      return new Response(JSON.stringify({ error: session.error?.message || 'Stripe error' }), {
        status: stripeRes.status, headers: cors
      });
    }

    return new Response(JSON.stringify({
      success: true,
      sessionId: session.id,
      url: session.url,
    }), { headers: cors });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors });
  }
}

// GET /api/checkout — return available price IDs for portal display
export async function onRequestGet(context) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  // These match the seeded products in 001_full_schema.sql
  return new Response(JSON.stringify({
    plans: [
      { name: 'Standard', priceId: 'price_1T7NCvA95N4c0ts1j6393yzD', amount: 2900, interval: 'bimonthly' },
      { name: 'Operator', priceId: 'price_1T7NCxA95N4c0ts17epbpXmg', amount: 5900, interval: 'bimonthly' },
      { name: 'First Class', priceId: 'price_1T7MRnA95N4c0ts1kGLJdkbL', amount: 9900, interval: 'month' },
      { name: 'Elite Monthly', priceId: 'price_1T7MRoA95N4c0ts10Jk6s521', amount: 19900, interval: 'month' },
      { name: 'Elite Annual', priceId: 'price_1T7N5lA95N4c0ts1Q4AIB2IC', amount: 199000, interval: 'year' },
    ],
  }), { headers: cors });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
