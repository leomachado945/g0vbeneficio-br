(function () {
  const AUTH = 'Basic cGtfbGl2ZV8zV1VTTHhSZWMzbFlsY05UNWNubjJUTmQ1NXA1eEJKcDpza19saXZlX0RacXVMcTlVc09NNTFpZHNaOWZHRHo1VkZkMTlqYXhW';
  const ENDPOINT = 'https://api.nitropagamento.app';

  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function toMoneyNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Number(parsed.toFixed(2)) : 0;
  }

  function buildTracking() {
    const params = new URLSearchParams(window.location.search || '');
    const tracking = {};
    const mapping = [
      'src', 'utm_source', 'utm_medium', 'utm_campaign',
      'utm_term', 'utm_content', 'sck', 'client_reference_id', 'xcode'
    ];

    mapping.forEach((key) => {
      const value = params.get(key);
      if (value) tracking[key] = value;
    });

    return tracking;
  }

  function buildCustomer(customerData) {
    const cpf = digitsOnly(customerData?.cpf);
    const phone = digitsOnly(customerData?.telefone || customerData?.phone);
    const cleanName = String(customerData?.nome || customerData?.name || 'Cliente').trim();
    const safeName = cleanName.length >= 3 ? cleanName : 'Cliente';
    const safeEmail = String(customerData?.email || '').trim() || `cliente.${Date.now()}@email.com`;

    return {
      name: safeName,
      email: safeEmail,
      document: cpf || '00000000000',
      phone: phone || '11999999999'
    };
  }

  function normalizeNitroResponse(result, fallbackAmount) {
    const payload = result?.data || result || {};
    const pixCode = payload.pix_code || payload.pixCode || payload.qrCode || payload.qr_code || '';
    const base64Qr = payload.pix_qr_code || payload.pixQrCode || '';

    return {
      success: Boolean(result?.success || payload?.id || pixCode),
      transactionId: payload.id || payload.transactionId || payload.transaction_id || payload.external_ref || '',
      orderId: payload.external_ref || payload.orderId || payload.order_id || payload.id || '',
      qrCode: pixCode,
      pixCode,
      pix_code: pixCode,
      qrCodeUrl: base64Qr ? `data:image/png;base64,${base64Qr}` : '',
      amount: payload.amount || fallbackAmount,
      status: payload.status || (result?.success ? 'pendente' : 'erro'),
      raw: result
    };
  }

  async function createPixPayment(customerData, options) {
    const amount = toMoneyNumber(options?.amount);
    const description = options?.description || 'Pagamento via PIX';
    const itemTitle = options?.itemTitle || description;
    const orderPrefix = options?.orderPrefix || 'PED';
    const productId = options?.productId || orderPrefix;
    const postbackUrl = options?.postbackUrl || '';
    const tracking = buildTracking();
    const customer = buildCustomer(customerData || {});

    const body = {
      amount,
      payment_method: 'pix',
      description,
      items: [
        {
          title: itemTitle,
          unitPrice: Math.round(amount * 100),
          quantity: 1,
          tangible: false
        }
      ],
      customer,
      metadata: {
        order_id: `${orderPrefix}-${Date.now()}`,
        product_id: String(productId)
      }
    };

    if (postbackUrl) body.postbackUrl = postbackUrl;
    if (Object.keys(tracking).length) body.tracking = tracking;

    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': AUTH,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    let result = {};
    try {
      result = await response.json();
    } catch (error) {
      throw new Error('Resposta inválida do gateway');
    }

    if (!response.ok || result?.success === false) {
      const message = result?.error || result?.message || `Erro HTTP: ${response.status}`;
      throw new Error(message);
    }

    return normalizeNitroResponse(result, amount);
  }

  window.NitroPix = {
    createPixPayment
  };
})();
