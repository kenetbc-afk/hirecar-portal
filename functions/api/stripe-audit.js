// TEMP — Stripe account audit. Tear down after Stripe sync is complete.
// GET /api/stripe-audit?token=410a2861183c93cf1f72b74bf56efca8

const TOKEN = '410a2861183c93cf1f72b74bf56efca8';

export async function onRequestGet(context) {
  const headers = { 'Content-Type': 'application/json' };
  const url = new URL(context.request.url);
  if (url.searchParams.get('token') !== TOKEN) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers });
  }

  const key = context.env?.STRIPE_SECRET_KEY;
  if (!key) {
    const raw = context.env?.STRIPE_SECRET_KEY;
    return new Response(JSON.stringify({
      error: 'STRIPE_SECRET_KEY empty',
      type: typeof raw,
      length: raw ? raw.length : 0,
      first_3: raw ? String(raw).slice(0, 3) : null,
      last_3: raw ? String(raw).slice(-3) : null
    }), { status: 500, headers });
  }
  const keyLen = key.length;
  const keyFirst3 = key.slice(0,3);
  const keyLast3 = key.slice(-3);

  const keyKind = key.startsWith('sk_live_') ? 'live'
                : key.startsWith('sk_test_') ? 'test'
                : key.startsWith('pk_') ? 'publishable (WRONG — needs sk_)'
                : 'unknown';

  async function stripeGet(path) {
    const r = await fetch('https://api.stripe.com/v1' + path, {
      headers: { 'Authorization': 'Bearer ' + key }
    });
    return { status: r.status, body: await r.json() };
  }

  const account = await stripeGet('/account');
  if (account.status !== 200) {
    return new Response(JSON.stringify({
      key_kind: keyKind,
      key_len: keyLen, key_first3: keyFirst3, key_last3: keyLast3,
      auth_check: 'FAILED',
      stripe_status: account.status,
      stripe_error: account.body
    }, null, 2), { status: 200, headers });
  }

  const products = await stripeGet('/products?limit=100&active=true');
  const prices = await stripeGet('/prices?limit=100&active=true&expand[]=data.product');

  const productList = (products.body.data || []).map(p => ({
    id: p.id, name: p.name, active: p.active, created: p.created,
    description: p.description, metadata: p.metadata
  }));

  const priceList = (prices.body.data || []).map(p => ({
    id: p.id,
    product_id: typeof p.product === 'string' ? p.product : p.product?.id,
    product_name: typeof p.product === 'object' ? p.product?.name : null,
    nickname: p.nickname,
    unit_amount: p.unit_amount,
    currency: p.currency,
    type: p.type,
    recurring: p.recurring,
    active: p.active
  }));

  return new Response(JSON.stringify({
    key_kind: keyKind,
    auth_check: 'OK',
    account: {
      id: account.body.id,
      business_name: account.body.business_profile?.name,
      country: account.body.country,
      charges_enabled: account.body.charges_enabled,
      payouts_enabled: account.body.payouts_enabled,
      details_submitted: account.body.details_submitted
    },
    product_count: productList.length,
    price_count: priceList.length,
    products: productList,
    prices: priceList
  }, null, 2), { headers });
}
