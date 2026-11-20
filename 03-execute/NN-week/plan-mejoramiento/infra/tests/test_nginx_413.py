#!/usr/bin/env python3
"""Regresión del proxy real, sin bases de datos, builds ni secretos del proyecto.

Requiere NGINX_TEST_IMAGE y PHP_TEST_IMAGE con imágenes locales que contengan
nginx (perfil app) y php (perfil api). Solo detiene los dos contenedores nuevos;
conserva contenedores/red y comprueba metadatos de recursos anteriores.
"""

import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import time
import unittest
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
LIMIT = 3 * 1024 * 1024
EXPECTED = {
    "code": "PAYLOAD_TOO_LARGE",
    "message": "La solicitud supera el tamaño máximo permitido.",
    "details": [],
}
UPSTREAM = {"code": "VALIDATION_ERROR", "message": "Validación simulada.", "details": []}


def docker(*args):
    result = subprocess.run(["docker", *args], text=True, capture_output=True, timeout=60)
    if result.returncode:
        raise RuntimeError("Falló una operación Docker del entorno de regresión aislado.")
    return result.stdout.strip()


def snapshot():
    ids = docker("ps", "-aq", "--no-trunc").split()
    containers = {}
    if ids:
        template = (
            '{"id":{{json .Id}},"started":{{json .State.StartedAt}},'
            '"running":{{json .State.Running}},"restarts":{{json .RestartCount}},'
            '"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}}}'
        )
        containers = {
            row["id"]: row
            for row in map(json.loads, docker("inspect", "--format", template, *ids).splitlines())
        }
    names = set(docker("volume", "ls", "-q").split())
    files = {
        str(path): hashlib.sha256(path.read_bytes()).digest() if path.exists() else None
        for path in [ROOT / "api/.env", ROOT / "infra/.env"]
    }
    return containers, names, files


class Nginx413Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.prefix = "kitchenware-rnf4-" + secrets.token_hex(6)
        cls.created = []
        cls.before = snapshot()
        cls.addClassCleanup(cls.preserve)
        if shutil.disk_usage(ROOT).free < 256 * 1024 * 1024:
            raise RuntimeError("Espacio insuficiente para crear el entorno aislado.")
        nginx_image = os.environ["NGINX_TEST_IMAGE"]
        php_image = os.environ["PHP_TEST_IMAGE"]
        # No descargar imágenes ni lanzar builds de forma implícita.
        for name in [nginx_image, php_image]:
            docker("image", "inspect", "--format", "{{.Id}}", name)
        cls.network = cls.prefix + "-network"
        docker("network", "create", cls.network)
        with tempfile.TemporaryDirectory(prefix="kitchenware-rnf4-") as directory:
            directory = Path(directory)
            config = directory / "nginx.conf"
            config.write_bytes((ROOT / "app/nginx.conf").read_bytes())
            config.chmod(0o644)
            stub = directory / "stub.php"
            stub.write_text(
                '<?php header("Content-Type: application/json; charset=utf-8"); '
                "http_response_code(422); echo "
                + repr(json.dumps(UPSTREAM, ensure_ascii=False))
                + ";"
            )
            stub.chmod(0o644)
            upstream = cls.prefix + "-api"
            docker(
                "create",
                "--pull=never",
                "--name",
                upstream,
                "--network",
                cls.network,
                "--network-alias",
                "api",
                "--entrypoint",
                "php",
                php_image,
                "-S",
                "0.0.0.0:8080",
                "/tmp/stub.php",
            )
            cls.created.append(upstream)
            docker("cp", str(stub), upstream + ":/tmp/stub.php")
            docker("start", upstream)
            proxy = cls.prefix + "-nginx"
            docker(
                "create",
                "--pull=never",
                "--name",
                proxy,
                "--network",
                cls.network,
                "--publish",
                "127.0.0.1::8080",
                nginx_image,
            )
            cls.created.append(proxy)
            docker("cp", str(config), proxy + ":/etc/nginx/conf.d/default.conf")
            # El archivo real se valida dentro del contenedor nuevo.
            docker("start", proxy)
        docker("exec", proxy, "nginx", "-t")
        cls.base = "http://" + docker("port", proxy, "8080/tcp")
        cls.opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        deadline = time.monotonic() + 15
        while time.monotonic() < deadline:
            try:
                if cls.request(b"{}")[0] == 422:
                    break
            except (OSError, urllib.error.URLError):
                pass
            time.sleep(0.1)
        else:
            raise RuntimeError("El proxy y su upstream de pruebas no estuvieron disponibles.")
        print("\nEntorno exclusivo: " + cls.prefix, flush=True)

    @classmethod
    def preserve(cls):
        for name in reversed(cls.created):
            docker("stop", name)
        current = snapshot()
        if not all(current[0].get(key) == row for key, row in cls.before[0].items()):
            raise AssertionError("Cambió un contenedor anterior a las pruebas.")
        if not cls.before[1].issubset(current[1]) or cls.before[2] != current[2]:
            raise AssertionError("Cambió un volumen anterior o un archivo .env.")
        print(
            "PASS: recursos previos y .env conservados; contenedores nuevos detenidos, sin eliminar recursos.",
            flush=True,
        )

    @classmethod
    def request(cls, body, method="POST", path="/api/v1/articles", extra_headers=None):
        request = urllib.request.Request(
            cls.base + path,
            data=body,
            method=method,
            headers={"Content-Type": "application/json", **(extra_headers or {})},
        )
        try:
            response = cls.opener.open(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, response.headers, response.read()

    def assert_uniform_413(self, response):
        status, headers, body = response
        self.assertEqual(status, 413)
        self.assertEqual(headers.get_content_type(), "application/json")
        self.assertEqual(headers.get_content_charset(), "utf-8")
        self.assertEqual(headers.get("X-Content-Type-Options"), "nosniff")
        self.assertIsNone(headers.get("Location"))
        self.assertEqual(json.loads(body), EXPECTED)
        self.assertNotIn(b"<html", body.lower())

    def test_four_mib_post_and_put_return_uniform_json_without_redirect(self):
        for method in ["POST", "PUT"]:
            with self.subTest(method=method):
                self.assert_uniform_413(self.request(b"x" * (4 * 1024 * 1024), method))

    def test_three_mib_boundary_is_preserved(self):
        status, headers, body = self.request(b" " * LIMIT)
        self.assertEqual(status, 422)  # La solicitud llegó al upstream simulado.
        self.assertEqual(json.loads(body), UPSTREAM)
        self.assert_uniform_413(self.request(b" " * (LIMIT + 1)))

    def test_upstream_validation_and_json_fields_remain_unchanged(self):
        status, headers, body = self.request(
            b"{}", method="PUT", path="/api/v1/articles/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/cover"
        )
        self.assertEqual(status, 422)
        self.assertEqual(headers.get_content_type(), "application/json")
        self.assertEqual(json.loads(body), UPSTREAM)


if __name__ == "__main__":
    unittest.main(verbosity=2)
