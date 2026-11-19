#!/usr/bin/env python3
"""React estático/Nginx + API + PostgreSQL en un proyecto exclusivo de prueba."""
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time

APP = Path(__file__).resolve().parents[1]
INFRA = APP.parent / 'infra'


def main():
    spec = importlib.util.spec_from_file_location('kitchenware_stack', INFRA / 'tests' / 'verify-stack.py')
    if spec is None or spec.loader is None:
        raise RuntimeError('No se encontró el verificador aislado.')
    module = importlib.util.module_from_spec(spec)
    sys.dont_write_bytecode = True
    spec.loader.exec_module(module)
    with tempfile.TemporaryDirectory(prefix='kitchenware-app-docker-test-') as directory:
        stack = module.Verification(directory)
        stack.compose += ['--file', str(INFRA / 'compose.app.yaml')]
        stack.process_env.update({'APP_BIND_ADDRESS': '127.0.0.1', 'APP_PORT': '0'})
        try:
            stack.baseline = stack.snapshot()
            config = json.loads(stack.run(['config', '--format', 'json']).stdout)
            if set(config['services']) != {'postgres', 'api', 'app'}:
                raise RuntimeError('Servicios inesperados en el stack de pruebas.')
            if not all(v['name'].startswith(stack.project + '_') for v in config['volumes'].values()):
                raise RuntimeError('Los volúmenes no pertenecen al proyecto de pruebas.')
            if any(name.startswith(stack.project + '_') for name in stack.baseline[1]) or any(
                    row['name'].lstrip('/').startswith(stack.project + '-') for row in stack.baseline[0].values()):
                raise RuntimeError('El proyecto ya existe; no se reutilizará.')
            if config['services']['app']['ports'][0]['published'] != '0':
                raise RuntimeError('El frontend no usa un puerto aleatorio.')
            stack.started = True
            stack.run(['up', '--build', '-d'])
            deadline = time.monotonic() + 180
            while time.monotonic() < deadline:
                raw = stack.run(['ps', '--format', 'json'], timeout=15).stdout.strip()
                rows = json.loads(raw) if raw.startswith('[') else [json.loads(line) for line in raw.splitlines()]
                if len(rows) == 3 and all(row.get('Health') == 'healthy' for row in rows):
                    break
                time.sleep(1)
            else:
                raise RuntimeError('Los tres servicios no alcanzaron el estado healthy.')
            print('PASS: PostgreSQL, API y React/Nginx saludables con un comando.', flush=True)
            uid = stack.run(['exec', '-T', 'app', 'id', '-u']).stdout.strip()
            stack.ok('React/Nginx se ejecuta sin privilegios de root', uid.isdigit() and int(uid) > 0)
            base = 'http://' + stack.run(['port', 'app', '8080']).stdout.strip()
            env = {k: v for k, v in os.environ.items() if not k.startswith(('VITE_', 'KITCHENWARE_TEST_'))}
            env.update({'KITCHENWARE_TEST_URL': base, 'KITCHENWARE_TEST_USERNAME': stack.env['ADMIN_USERNAME'], 'KITCHENWARE_TEST_PASSWORD': stack.admin_password})
            result = subprocess.run(['node', 'node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.docker.config.ts'], cwd=APP, env=env, capture_output=True, text=True, timeout=150)
            if result.returncode:
                raise RuntimeError('Falló la prueba Docker; no se publican trazas con credenciales de prueba.')
            summary = re.search(r'(\d+) passed', re.sub(r'\x1b\[[0-9;]*m', '', result.stdout))
            if not summary:
                raise RuntimeError('No se pudo verificar el número de pruebas aprobadas.')
            print(f'PASS: {summary.group(1)} pruebas de navegador contra React compilado/Nginx/Laravel/PostgreSQL.')
        finally:
            stack.cleanup()
            stack.verify_preservation()


if __name__ == '__main__':
    main()
