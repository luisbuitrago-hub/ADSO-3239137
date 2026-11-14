<?php

require __DIR__.'/../vendor/autoload.php';

// Comprobar antes de arrancar Laravel; no borrar ni reemplazar cachés existentes.
$application = require __DIR__.'/../bootstrap/app.php';

if ($application->configurationIsCached()) {
    throw new RuntimeException('Las pruebas requieren configuración sin caché para aislar la base de datos.');
}

unset($application);
