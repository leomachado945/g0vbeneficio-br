(function () {
  const CREATE_ENDPOINT = '/api/create-pix';
  const STATUS_ENDPOINT = '/api/status-pix';

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function buildTracking() {
    const params = new URLSearchParams(window.location.search || '');
    const tracking = {};
    const fields = [
      'src', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_term', 'utm_content', 'sck', 'client_reference_id', 'xcode'
    ];
    fields.forEach((key) => {
      const value = params.get(key);
      if (value) tracking[key] = value;
    });
    return tracking;
  }

  function buildCustomer(customerData) {
    const name = String(customerData?.nome || customerData?.name || 'Cliente Pagador').trim() || 'Cliente Pagador';
    const document = digitsOnly(customerData?.cpf || customerData?.document) || '12345678909';
    const phone = digitsOnly(customerData?.telefone || customerData?.phone) || '11999999999';
    const email = String(customerData?.email || '').trim() || `cliente.${Date.now()}@email.com`;
    return { name, email, document, phone };
  }

  function normalizeResponse(result, fallbackAmount) {
    const payload = result?.data || result || {};
    const pixCode = payload.pix_code || payload.pixCode || payload.qrCode || payload.qr_code || '';
    const qrBase64 = payload.pix_qr_code || payload.pixQrCode || '';
    return {
      success: Boolean(result?.success !== false && (payload.id || pixCode || result?.success)),
      transactionId: payload.id || payload.transactionId || payload.transaction_id || payload.external_ref || '',
      orderId: payload.external_ref || payload.orderId || payload.order_id || payload.id || '',
      qrCode: pixCode,
      pixCode,
      pix_code: pixCode,
      qrCodeUrl: qrBase64 ? `data:image/png;base64,${qrBase64}` : '',
      amount: payload.amount || fallbackAmount,
      status: payload.status || result?.status || 'waiting_payment',
      paid: ['paid', 'approved', 'completed'].includes(String(payload.status || result?.status || '').toLowerCase()),
      raw: result
    };
  }

  async function parseJson(response) {
    const text = await response.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Resposta inválida do servidor');
    }
  }

  async function createPixPayment(customerData, options) {
    const amount = Number(options?.amount || 0);
    const description = options?.description || 'Pagamento via PIX';
    const itemTitle = options?.itemTitle || description;
    const orderPrefix = options?.orderPrefix || 'PED';
    const productId = options?.productId || orderPrefix;
    const body = {
      amount: Number(amount.toFixed(2)),
      payment_method: 'pix',
      description,
      items: [{
        title: itemTitle,
        unitPrice: Math.round(amount * 100),
        quantity: 1,
        tangible: false
      }],
      customer: buildCustomer(customerData || {}),
      metadata: {
        order_id: `${orderPrefix}-${Date.now()}`,
        product_id: String(productId)
      },
      tracking: buildTracking()
    };

    const response = await fetch(CREATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await parseJson(response);
    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || result?.message || `Erro HTTP ${response.status}`);
    }
    return normalizeResponse(result, amount);
  }

  async function getPaymentStatus(transactionId) {
    const response = await fetch(`${STATUS_ENDPOINT}?transactionId=${encodeURIComponent(transactionId)}`);
    const result = await parseJson(response);
    if (!response.ok || result?.success === false) {
      throw new Error(result?.error || result?.message || `Erro HTTP ${response.status}`);
    }
    return normalizeResponse(result, 0);
  }

  window.NitroPix = { createPixPayment, getPaymentStatus };
})();
