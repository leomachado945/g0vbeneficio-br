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

function nitroRequest($method, $url, $auth, $body = null) {
    if (!function_exists('curl_init')) {
        respond(500, [
            'success' => false,
            'error' => 'cURL não está habilitado no servidor.'
        ]);
    }

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
    $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($responseBody === false || $curlError) {
        respond(502, [
            'success' => false,
            'error' => 'Falha ao comunicar com o gateway Nitro.',
            'details' => $curlError
        ]);
    }

    $decoded = json_decode($responseBody, true);
    if (!is_array($decoded)) {
        respond(502, [
            'success' => false,
            'error' => 'Resposta inválida do gateway Nitro.',
            'raw' => $responseBody
        ]);
    }

    return [$statusCode, $decoded];
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

    [$statusCode, $gatewayResponse] = nitroRequest('POST', $baseUrl, $auth, $payload);
    respond($statusCode ?: 200, $gatewayResponse);
}

if ($action === 'status') {
    $id = trim($_GET['id'] ?? '');
    if ($id === '') {
        respond(400, ['success' => false, 'error' => 'ID da transação não informado.']);
    }

    [$statusCode, $gatewayResponse] = nitroRequest('GET', $baseUrl . '/transactions/' . rawurlencode($id), $auth);
    respond($statusCode ?: 200, $gatewayResponse);
}

respond(400, ['success' => false, 'error' => 'Ação inválida.']);
