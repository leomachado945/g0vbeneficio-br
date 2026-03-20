const PUBLIC_KEY = process.env.NITRO_PUBLIC_KEY || 'pk_live_3WUSLxRec3lYlcNT5cnn2TNd55p5xBJp';
const SECRET_KEY = process.env.NITRO_SECRET_KEY || 'sk_live_DZquLq9UsOM51idsZ9fGDz5VFd19jaxV';
const ENDPOINT = 'https://api.nitropagamento.app';

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

function sanitizePayload(payload = {}) {
  const amount = Number(Number(payload.amount || 0).toFixed(2));
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Valor do pagamento inválido');
  }

  const customer = payload.customer || {};
  return {
    amount,
    payment_method: 'pix',
    description: payload.description || 'Pagamento via PIX',
    items: [{
      title: payload?.items?.[0]?.title || payload.description || 'Pagamento via PIX',
      unitPrice: Math.round(amount * 100),
      quantity: 1,
      tangible: false
    }],
    customer: {
      name: String(customer.name || 'Cliente Pagador').trim() || 'Cliente Pagador',
      email: String(customer.email || 'cliente@example.com').trim() || 'cliente@example.com',
      document: digitsOnly(customer.document) || '12345678909',
      phone: digitsOnly(customer.phone) || '11999999999'
    },
    metadata: {
      order_id: String(payload?.metadata?.order_id || `ORD-${Date.now()}`),
      product_id: String(payload?.metadata?.product_id || 'produto')
    },
    ...(payload.postbackUrl ? { postbackUrl: payload.postbackUrl } : {}),
    ...(payload.tracking && Object.keys(payload.tracking).length ? { tracking: payload.tracking } : {})
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  try {
    const payload = sanitizePayload(req.body || {});
    const auth = Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64');

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return res.status(502).json({ success: false, error: 'Resposta inválida da Nitro', raw: text });
    }

    return res.status(response.status).json(data);
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Erro interno' });
  }
}
