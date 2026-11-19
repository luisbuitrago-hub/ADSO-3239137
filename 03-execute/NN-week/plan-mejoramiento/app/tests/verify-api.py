#!/usr/bin/env python3
"""Browser React + proxy Vite + Laravel/PostgreSQL reales, exclusivamente aislados."""
import importlib.util
import json
import os
import re
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request

APP = Path(__file__).resolve().parents[1]
INFRA = APP.parent / 'infra'


def main():
    spec = importlib.util.spec_from_file_location('kitchenware_stack', INFRA / 'tests' / 'verify-stack.py')
    if spec is None or spec.loader is None:
        raise RuntimeError('No se encontró el verificador aislado de infraestructura.')
    module = importlib.util.module_from_spec(spec)
    sys.dont_write_bytecode = True
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory(prefix='kitchenware-react-test-') as directory:
        stack = module.Verification(directory)
        server = None
        try:
            # Reutilizar el aislamiento existente; no leer credenciales de desarrollo.
            stack.baseline = stack.snapshot()
            config = json.loads(stack.run(['config', '--format', 'json']).stdout)
            if not all(item['name'].startswith(stack.project + '_') for item in config['volumes'].values()):
                raise RuntimeError('Los volúmenes no pertenecen al proyecto aislado.')
            if any(name.startswith(stack.project + '_') for name in stack.baseline[1]) or any(
                    row['name'].lstrip('/').startswith(stack.project + '-') for row in stack.baseline[0].values()):
                raise RuntimeError('El proyecto ya existe; no se reutilizará.')
            stack.started = True
            stack.run(['up', '--build', '-d'])
            stack.wait()
            with socket.socket() as available:
                available.bind(('127.0.0.1', 0))
                port = available.getsockname()[1]
            env = {key: value for key, value in os.environ.items() if not key.startswith(('VITE_', 'KITCHENWARE_TEST_'))}
            env.update({'API_PROXY_TARGET': stack.base, 'VITE_API_BASE_URL': '/api/v1', 'DEV_PORT': str(port)})
            with open(Path(directory) / 'vite.log', 'w+') as logs:
                # Aislar el servidor auxiliar y sus señales de cierre del runner/npm.
                server = subprocess.Popen(['node', 'node_modules/vite/bin/vite.js'], cwd=APP, env=env, stdout=logs, stderr=logs, start_new_session=True)
                base = f'http://127.0.0.1:{port}'
                for _ in range(60):
                    if server.poll() is not None:
                        raise RuntimeError('Vite no pudo iniciar en el puerto aislado.')
                    try:
                        with urllib.request.urlopen(base + '/api/v1/health', timeout=2) as result:
                            if result.status == 200:
                                break
                    except (urllib.error.URLError, TimeoutError):
                        time.sleep(.5)
                else:
                    raise RuntimeError('El proxy no pudo conectar con Laravel aislado.')
                env.update({'KITCHENWARE_TEST_URL': base, 'KITCHENWARE_TEST_USERNAME': stack.env['ADMIN_USERNAME'], 'KITCHENWARE_TEST_PASSWORD': stack.admin_password})
                result = subprocess.run(['node', 'node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.real.config.ts'], cwd=APP, env=env, capture_output=True, text=True, timeout=150)
                # No emitir diagnósticos del navegador con credenciales/JWT reales de prueba.
                if result.returncode:
                    raise RuntimeError('Falló la prueba real de React/proxy/API; no se muestran trazas con credenciales temporales.')
                summary = re.search(r'(\d+) passed', re.sub(r'\x1b\[[0-9;]*m', '', result.stdout))
                if not summary:
                    raise RuntimeError('No se pudo verificar el número de pruebas reales aprobadas.')
                print(f'PASS: {summary.group(1)} pruebas de navegador React/proxy/Laravel real.')
                deleted = stack.php('require "vendor/autoload.php"; $app = require "bootstrap/app.php"; $app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); echo DB::table("article")->whereNotNull("deleted_at")->count();')
                if int(deleted) < 1:
                    raise RuntimeError('No se pudo verificar la conservación de la baja lógica en la base aislada.')
                print('PASS: la baja conserva la fila del artículo en PostgreSQL aislado.')
        finally:
            if server is not None:
                server.terminate()
                try:
                    server.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    server.kill()
                    server.wait()
            stack.cleanup()
            stack.verify_preservation()


if __name__ == '__main__':
    main()
