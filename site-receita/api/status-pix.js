const PUBLIC_KEY = process.env.NITRO_PUBLIC_KEY || 'pk_live_3WUSLxRec3lYlcNT5cnn2TNd55p5xBJp';
const SECRET_KEY = process.env.NITRO_SECRET_KEY || 'sk_live_DZquLq9UsOM51idsZ9fGDz5VFd19jaxV';
const ENDPOINT = 'https://api.nitropagamento.app';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Método não permitido' });
  }

  const transactionId = req.query.transactionId;
  if (!transactionId) {
    return res.status(400).json({ success: false, error: 'transactionId é obrigatório' });
  }

  try {
    const auth = Buffer.from(`${PUBLIC_KEY}:${SECRET_KEY}`).toString('base64');
    const response = await fetch(`${ENDPOINT}/transactions/${encodeURIComponent(transactionId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json'
      }
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
