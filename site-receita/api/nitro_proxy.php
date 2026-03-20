<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    http_response_code(204);
    exit;
}

$publicKey = 'pk_live_3WUSLxRec3lYlcNT5cnn2TNd55p5xBJp';
$privateKey = 'sk_live_DZquLq9UsOM51idsZ9fGDz5VFd19jaxV';
$baseUrl = 'https://api.nitropagamento.app';
$auth = 'Basic ' . base64_encode($publicKey . ':' . $privateKey);
$action = $_GET['action'] ?? 'create';

function respond($statusCode, $payload) {
    http_response_code($statusCode);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function digits_only($value) {
    return preg_replace('/\D+/', '', (string)$value);
}

function sanitize_payload(array $payload) {
    $amount = isset($payload['amount']) ? round((float)$payload['amount'], 2) : 0;
    if ($amount <= 0) {
        respond(400, ['success' => false, 'error' => 'Valor do pagamento inválido.']);
    }

    $description = trim((string)($payload['description'] ?? 'Pagamento via PIX'));
    if ($description === '') {
        $description = 'Pagamento via PIX';
    }

    $customer = is_array($payload['customer'] ?? null) ? $payload['customer'] : [];
    $name = trim((string)($customer['name'] ?? ''));
    if (mb_strlen($name) < 5) {
        $name = 'Cliente Pagador';
    }

    $email = trim((string)($customer['email'] ?? ''));
    if ($email === '' || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
        $email = 'cliente@example.com';
    }

    $document = digits_only($customer['document'] ?? '');
    if (strlen($document) !== 11 && strlen($document) !== 14) {
        $document = '12345678909';
    }

    $phone = digits_only($customer['phone'] ?? '');
    if (strlen($phone) < 10 || strlen($phone) > 13) {
        $phone = '11999999999';
    }

    $itemTitle = trim((string)($payload['items'][0]['title'] ?? $description));
    if ($itemTitle === '') {
        $itemTitle = $description;
    }

    $quantity = max(1, (int)($payload['items'][0]['quantity'] ?? 1));
    $unitPrice = (int) round($amount * 100);

    $metadata = is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [];
    $metadata['order_id'] = (string)($metadata['order_id'] ?? ('ORD-' . time()));
    if (isset($metadata['product_id'])) {
        $metadata['product_id'] = (string)$metadata['product_id'];
    }

    $final = [
        'amount' => $amount,
        'payment_method' => 'pix',
        'description' => $description,
        'items' => [[
            'title' => $itemTitle,
            'unitPrice' => $unitPrice,
            'quantity' => $quantity,
            'tangible' => false,
        ]],
        'customer' => [
            'name' => $name,
            'email' => $email,
            'document' => $document,
            'phone' => $phone,
        ],
        'metadata' => $metadata,
    ];

    if (!empty($payload['postbackUrl']) && filter_var($payload['postbackUrl'], FILTER_VALIDATE_URL)) {
        $final['postbackUrl'] = $payload['postbackUrl'];
    }

    if (!empty($payload['tracking']) && is_array($payload['tracking'])) {
        $tracking = array_filter($payload['tracking'], function ($value) {
            return $value !== null && $value !== '';
        });
        if (!empty($tracking)) {
            $final['tracking'] = $tracking;
        }
    }

    return $final;
}

function do_request_stream($method, $url, $auth, $body = null) {
    $headers = [
        'Authorization: ' . $auth,
        'Content-Type: application/json',
        'Accept: application/json'
    ];

    $options = [
        'http' => [
            'method' => strtoupper($method),
            'header' => implode("\r\n", $headers),
            'ignore_errors' => true,
            'timeout' => 30,
        ],
        'ssl' => [
            'verify_peer' => true,
            'verify_peer_name' => true,
        ],
    ];

    if ($body !== null) {
        $options['http']['content'] = json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    $context = stream_context_create($options);
    $responseBody = @file_get_contents($url, false, $context);
    $responseHeaders = $http_response_header ?? [];
    $statusCode = 0;

    foreach ($responseHeaders as $header) {
        if (preg_match('#HTTP/\S+\s+(\d{3})#', $header, $m)) {
            $statusCode = (int)$m[1];
            break;
        }
    }

    if ($responseBody === false && $statusCode === 0) {
        respond(502, [
            'success' => false,
            'error' => 'Falha ao comunicar com o gateway Nitro.',
            'details' => 'stream_request_failed'
        ]);
    }

    return [$statusCode ?: 200, $responseBody];
}

function nitroRequest($method, $url, $auth, $body = null) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $headers = [
            'Authorization: ' . $auth,
            'Content-Type: application/json',
            'Accept: application/json'
        ];

        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_CUSTOMREQUEST => strtoupper($method),
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);

        if ($body !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        }

        $responseBody = curl_exec($ch);
        $curlError = curl_error($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($responseBody === false || $curlError) {
            return do_request_stream($method, $url, $auth, $body);
        }

        return [$statusCode ?: 200, $responseBody];
    }

    return do_request_stream($method, $url, $auth, $body);
}

if ($action === 'create') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        respond(405, ['success' => false, 'error' => 'Método não permitido.']);
    }

    $rawInput = file_get_contents('php://input');
    $payload = json_decode($rawInput, true);

    if (!is_array($payload)) {
        respond(400, ['success' => false, 'error' => 'JSON inválido.']);
    }

    $sanitized = sanitize_payload($payload);
    [$statusCode, $responseBody] = nitroRequest('POST', $baseUrl, $auth, $sanitized);
    $gatewayResponse = json_decode($responseBody, true);

    if (!is_array($gatewayResponse)) {
        respond($statusCode >= 400 ? $statusCode : 502, [
            'success' => false,
            'error' => 'Resposta inválida do gateway Nitro.',
            'raw' => $responseBody,
            'request_payload' => $sanitized
        ]);
    }

    if (($gatewayResponse['success'] ?? null) === false || $statusCode >= 400) {
        $gatewayResponse['request_payload'] = $sanitized;
    }

    respond($statusCode ?: 200, $gatewayResponse);
}

if ($action === 'status') {
    $id = trim($_GET['id'] ?? '');
    if ($id === '') {
        respond(400, ['success' => false, 'error' => 'ID da transação não informado.']);
    }

    [$statusCode, $responseBody] = nitroRequest('GET', $baseUrl . '/transactions/' . rawurlencode($id), $auth);
    $gatewayResponse = json_decode($responseBody, true);

    if (!is_array($gatewayResponse)) {
        respond($statusCode >= 400 ? $statusCode : 502, [
            'success' => false,
            'error' => 'Resposta inválida do gateway Nitro.',
            'raw' => $responseBody
        ]);
    }

    respond($statusCode ?: 200, $gatewayResponse);
}

respond(400, ['success' => false, 'error' => 'Ação inválida.']);
