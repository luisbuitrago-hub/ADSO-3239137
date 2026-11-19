<?php

try {
    $body = @file_get_contents('http://127.0.0.1:8080/api/v1/health', false, stream_context_create(['http' => ['timeout' => 2]]));
    if ($body === false || (json_decode($body, true)['status'] ?? null) !== 'ok') {
        exit(1);
    }
    $db = new PDO('pgsql:host='.getenv('DB_HOST').';port=5432;dbname='.getenv('DB_DATABASE'), getenv('DB_USERNAME'), getenv('DB_PASSWORD'), [PDO::ATTR_TIMEOUT => 2]);
    $db->query('SELECT 1 FROM kitchenware.category LIMIT 1');
    exit(0);
} catch (Throwable) {
    // Docker conserva la salida del healthcheck: nunca incluir excepciones.
    exit(1);
}
