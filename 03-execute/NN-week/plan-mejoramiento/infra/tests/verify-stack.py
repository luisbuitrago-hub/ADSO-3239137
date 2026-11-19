#!/usr/bin/env python3
"""Verificación HTTP/Docker aislada; nunca usa el .env ni el proyecto de desarrollo."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
import zlib


INFRA = Path(__file__).resolve().parents[1]
ROOT = INFRA.parent


class Verification:
    def __init__(self, directory):
        self.project = "kitchenware-infra-test-" + secrets.token_hex(6)
        self.secrets = [secrets.token_hex(32) for _ in range(3)]
        self.password, self.jwt, self.admin_password = self.secrets
        self.app_key = "base64:" + base64.b64encode(secrets.token_bytes(32)).decode()
        self.secrets.append(self.app_key)
        self.env = {
            "POSTGRES_DB": "kitchenware_verify", "POSTGRES_USER": "kitchenware_verify",
            "POSTGRES_PASSWORD": self.password, "JWT_SECRET": self.jwt,
            "ADMIN_USERNAME": "infra_verification", "ADMIN_PASSWORD": self.admin_password,
            "APP_KEY": self.app_key, "CORS_ORIGIN": "http://localhost:5173",
            "API_BIND_ADDRESS": "127.0.0.1", "API_PORT": "0",
        }
        env_file = Path(directory) / "stack.env"
        env_file.write_text("".join(f"{key}={value}\n" for key, value in self.env.items()))
        env_file.chmod(0o600)
        # El entorno del equipo no puede sustituir las variables de prueba.
        self.process_env = {key: value for key, value in os.environ.items()
                            if key not in self.env and not key.startswith("COMPOSE_")}
        self.compose = ["docker", "compose", "--env-file", str(env_file),
                        "--project-name", self.project, "--file", str(INFRA / "compose.yaml")]
        self.passed = 0
        self.started = False
        self.baseline = None

    def redact(self, value):
        for secret in self.secrets:
            value = value.replace(secret, "[REDACTED]")
        return value

    def run(self, arguments, compose=True, check=True, timeout=600):
        result = subprocess.run((self.compose if compose else []) + arguments,
                                env=self.process_env, text=True, capture_output=True, timeout=timeout)
        if check and result.returncode:
            raise RuntimeError(self.redact(result.stdout + result.stderr))
        return result

    def ok(self, label, condition=True):
        if not condition:
            raise AssertionError(label)
        self.passed += 1
        print("PASS: " + label, flush=True)

    def snapshot(self):
        # Pedir solo metadatos: docker inspect completo incluiría secretos del entorno.
        ids = self.run(["docker", "ps", "--all", "--quiet", "--no-trunc"], compose=False).stdout.split()
        containers = {}
        if ids:
            template = ('{"id":{{json .Id}},"name":{{json .Name}},'
                        '"started":{{json .State.StartedAt}},"running":{{json .State.Running}},'
                        '"restarts":{{json .RestartCount}},"ports":{{json .HostConfig.PortBindings}},'
                        '"mounts":{{json .Mounts}}}')
            output = self.run(["docker", "inspect", "--format", template, *ids], compose=False).stdout
            containers = {row["id"]: row for row in map(json.loads, output.splitlines())}
        names = self.run(["docker", "volume", "ls", "--quiet"], compose=False).stdout.split()
        volumes = {}
        if names:
            template = ('{"name":{{json .Name}},"created":{{json .CreatedAt}},'
                        '"driver":{{json .Driver}},"mountpoint":{{json .Mountpoint}}}')
            output = self.run(["docker", "volume", "inspect", "--format", template, *names], compose=False).stdout
            volumes = {row["name"]: row for row in map(json.loads, output.splitlines())}
        # La huella se compara en memoria y nunca se imprime ni guarda.
        files = {}
        for path in [ROOT / "api" / ".env", INFRA / ".env"]:
            files[str(path)] = hashlib.sha256(path.read_bytes()).digest() if path.exists() else None
        return containers, volumes, files

    def verify_preservation(self):
        if self.baseline is None:
            return
        before_containers, before_volumes, before_files = self.baseline
        containers, volumes, files = self.snapshot()
        self.ok("Contenedores previos conservan identidad, arranque, puertos y montajes",
                all(containers.get(key) == value for key, value in before_containers.items()))
        self.ok("Volúmenes previos conservados sin reemplazo",
                all(volumes.get(key) == value for key, value in before_volumes.items()))
        self.ok("Archivos .env reales sin cambios", files == before_files)

    def wait(self):
        deadline = time.monotonic() + 120
        while time.monotonic() < deadline:
            result = self.run(["ps", "--format", "json"], timeout=15)
            # Compose permite salida JSON por línea o arreglo, según versión.
            raw = result.stdout.strip()
            rows = json.loads(raw) if raw.startswith("[") else [json.loads(line) for line in raw.splitlines()]
            if len(rows) == 2 and all(row.get("Health") == "healthy" for row in rows):
                self.base = "http://" + self.run(["port", "api", "8080"]).stdout.strip()
                return
            time.sleep(1)
        raise RuntimeError("Los dos servicios no alcanzaron el estado healthy.")

    def request(self, method, path, payload=None, token=None, content_type="application/json", extra_headers=None):
        data = payload if isinstance(payload, bytes) else (json.dumps(payload).encode() if payload is not None else None)
        headers = {"Accept": "application/json", "Content-Type": content_type, **(extra_headers or {})}
        if token:
            headers["Authorization"] = "Bearer " + token
        request = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
        try:
            response = urllib.request.urlopen(request, timeout=15)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            return response.status, response.read(), response.headers

    def login(self):
        status, body, _ = self.request("POST", "/api/v1/auth/login", {
            "username": self.env["ADMIN_USERNAME"], "password": self.admin_password})
        if status != 200:
            raise AssertionError("Login del administrador inicial")
        data = json.loads(body)
        self.token = data["access_token"]
        self.secrets.append(self.token)
        self.ok("Administrador inicial y JWT de ocho horas", data["expires_in"] == 28800 and data["role"] == "admin")

    def php(self, source):
        return self.run(["exec", "-T", "--user", "www-data", "api", "php", "-r", source]).stdout.strip()

    @staticmethod
    def png():
        def chunk(kind, data):
            return struct.pack("!I", len(data)) + kind + data + struct.pack("!I", zlib.crc32(kind + data))
        return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack("!2I5B", 1, 1, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(b"\x00\xff\x00\x00")) + chunk(b"IEND", b"")

    def execute(self):
        self.baseline = self.snapshot()
        containers, volumes, _ = self.baseline
        if any(row["name"].lstrip("/").startswith(self.project + "-") for row in containers.values()) or any(
                name.startswith(self.project + "_") for name in volumes):
            raise RuntimeError("El proyecto de prueba ya existe; no se reutilizará.")
        self.ok("Inventario previo capturado y nombre de proyecto libre")
        config = json.loads(self.run(["config", "--format", "json"]).stdout)
        postgres, api = config["services"]["postgres"], config["services"]["api"]
        self.ok("Compose válido, PostgreSQL sin puerto publicado y dependencia saludable",
                not postgres.get("ports") and api["depends_on"]["postgres"]["condition"] == "service_healthy")
        self.ok("Volúmenes independientes y red interna",
                config["networks"]["database"]["internal"] and
                all(volume["name"].startswith(self.project + "_") for volume in config["volumes"].values()))
        optional = json.loads(self.run(["--file", str(INFRA / "compose.db-access.yaml"),
                                         "config", "--format", "json"]).stdout)
        self.ok("Acceso PostgreSQL opcional limitado a localhost",
                optional["services"]["postgres"]["ports"][0]["host_ip"] == "127.0.0.1")
        self.started = True
        self.run(["up", "--build", "-d"])
        self.wait()
        self.ok("Construcción y arranque con un comando; ambos healthchecks saludables")
        status, body, _ = self.request("GET", "/api/v1/health")
        self.ok("Salud HTTP", status == 200 and json.loads(body) == {"status": "ok"})
        source = ('require "vendor/autoload.php"; $app = require "bootstrap/app.php"; '
                  '$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); '
                  'echo json_encode([DB::selectOne("SELECT current_database() AS name")->name, '
                  'DB::table("migrations")->count(), DB::table("category")->count(), '
                  'DB::table("user")->count()]);')
        self.ok("Laravel conectado a PostgreSQL, seis migraciones, cinco categorías y un administrador",
                json.loads(self.php(source)) == ["kitchenware_verify", 6, 5, 1])
        bootstrap = source.split("echo json_encode", 1)[0]
        schema = json.loads(self.php(bootstrap + 'echo json_encode(DB::select('
            '"SELECT table_name FROM information_schema.tables WHERE table_schema = ? AND table_type = ?", '
            '["kitchenware", "BASE TABLE"]));'))
        self.ok("Esquema kitchenware con las seis tablas de negocio y repositorio migrations",
                sorted(row["table_name"] for row in schema) == ["article", "category", "loan", "loan_item", "migrations", "neighbor", "user"])
        runtime = json.loads(self.php(bootstrap + 'echo json_encode([PHP_VERSION_ID, extension_loaded("pdo_pgsql"), '
            'extension_loaded("sodium"), DB::selectOne("SELECT current_setting(\'TimeZone\') AS timezone")->timezone]);'))
        self.ok("PHP 8.4, pdo_pgsql, Sodium y conexión UTC", 80400 <= runtime[0] < 80500 and runtime[1:] == [True, True, "UTC"])
        self.login()
        status, body, _ = self.request("GET", "/api/v1/categories", token=self.token)
        categories = json.loads(body)
        # El endpoint devuelve una lista de categorías sin paginación.
        self.ok("Catálogo PostgreSQL accesible por HTTP", status == 200 and len(categories) == 5)
        status, body, _ = self.request("POST", "/api/v1/articles", {
            "name": "Infra verification", "description": "Isolated persistence check",
            "reference": "INFRA-VERIFY", "category_id": categories[0]["id"], "total_units": 2}, token=self.token)
        self.ok("Registro de artículo en la base aislada", status == 201)
        self.article = json.loads(body)["id"]
        self.image = self.png()
        boundary = "Kitchenware" + secrets.token_hex(8)
        multipart = (f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../private.png"\r\n'
                     'Content-Type: image/png\r\n\r\n').encode() + self.image + f"\r\n--{boundary}--\r\n".encode()
        cover = f"/api/v1/articles/{self.article}/cover"
        status, body, _ = self.request("PUT", cover, multipart, self.token, "multipart/form-data; boundary=" + boundary)
        self.ok("Carga multipart PUT real y clave opaca", status == 200 and
                re.fullmatch(r"[a-f0-9]{64}\.png", json.loads(body).get("cover_key", "")) is not None)
        self.cover_key = json.loads(body)["cover_key"]
        permissions = self.php('echo decoct(fileperms(getenv("COVERS_DIR")."/'+self.cover_key+'") & 0777);')
        self.ok("Imagen privada con permisos 0600", permissions == "600")
        status, body, _ = self.request("GET", cover, token=self.token)
        self.ok("Descarga autenticada conserva los bytes", status == 200 and body == self.image)
        # El límite debe conservarse detrás de Apache y del parser multipart nativo.
        data = b"padding\x00" + b"x" * (2097152 - len(self.image) - 20)
        chunk = struct.pack("!I", len(data)) + b"tEXt" + data + struct.pack("!I", zlib.crc32(b"tEXt" + data))
        exact_image = self.image[:-12] + chunk + self.image[-12:]
        exact_multipart = multipart.replace(self.image, exact_image)
        status, _, _ = self.request("PUT", cover, exact_multipart, self.token, "multipart/form-data; boundary=" + boundary)
        self.ok("Archivo de exactamente 2 MiB aceptado por HTTP real", status == 200)
        status, body, _ = self.request("PUT", cover, exact_multipart.replace(exact_image, exact_image + b"x"),
                                       self.token, "multipart/form-data; boundary=" + boundary)
        self.ok("Archivo de 2 MiB + 1 rechazado con JSON uniforme", status == 422 and
                set(json.loads(body)) == {"code", "message", "details"})
        # Restaurar el fixture pequeño mediante el endpoint público.
        status, body, _ = self.request("PUT", cover, multipart, self.token, "multipart/form-data; boundary=" + boundary)
        self.ok("Reemplazo de imagen conserva el endpoint y sus permisos", status == 200)
        self.cover_key = json.loads(body)["cover_key"]
        status, body, _ = self.request("GET", cover)
        self.ok("Imagen rechazada sin JWT", status == 401 and json.loads(body)["code"] == "INVALID_CREDENTIALS")
        status, _, _ = self.request("GET", "/storage/" + self.cover_key)
        self.ok("Archivo no publicado directamente", status == 404)
        status, _, headers = self.request("OPTIONS", "/api/v1/articles", extra_headers={
            "Origin": "http://localhost:5173", "Access-Control-Request-Method": "GET"})
        self.ok("CORS usa el origen configurado", status == 204 and headers.get("Access-Control-Allow-Origin") == "http://localhost:5173")
        status, _, headers = self.request("OPTIONS", "/api/v1/articles", extra_headers={
            "Origin": "http://untrusted.invalid", "Access-Control-Request-Method": "GET"})
        # Con un solo origen, el middleware puede devolver siempre ese origen fijo;
        # el navegador rechaza la respuesta porque no coincide con el solicitante.
        self.ok("CORS no autoriza otro origen", headers.get("Access-Control-Allow-Origin") not in ["*", "http://untrusted.invalid"])
        self.ok("Proceso web sin privilegios root y sin .env en la imagen",
                self.php('echo json_encode([file_exists(".env"), preg_match("/Uid:\\s+33\\s+33/", file_get_contents("/proc/1/status"))]);') == "[false,1]")
        # Provocar un login inválido y añadir un secreto a la query para auditar logs.
        self.request("POST", "/api/v1/auth/login?password=" + self.password, {
            "username": self.env["ADMIN_USERNAME"], "password": self.password})
        self.run(["restart"])
        self.wait()
        status, body, _ = self.request("GET", cover, token=self.token)
        self.ok("PostgreSQL, JWT e imagen persisten después de reiniciar", status == 200 and body == self.image)
        # Recrear los contenedores verifica volúmenes, no solo sus capas escribibles.
        self.run(["up", "-d", "--force-recreate"])
        self.wait()
        self.ok("Inicialización idempotente después de recrear contenedores",
                json.loads(self.php(source)) == ["kitchenware_verify", 6, 5, 1])
        status, body, _ = self.request("GET", cover, token=self.token)
        self.ok("Volumen de imágenes y datos sobreviven la recreación", status == 200 and body == self.image)
        self.login()
        status, body, _ = self.request("GET", f"/api/v1/articles/{self.article}", token=self.token)
        self.ok("Inventario preservado", status == 200 and json.loads(body)["available_units"] == 2)
        logs = self.run(["logs", "--no-color"]).stdout
        self.ok("Logs sin contraseñas, APP_KEY, JWT_SECRET ni tokens de la prueba",
                all(secret not in logs for secret in self.secrets))
        for override in ["APP_KEY=invalid", "JWT_SECRET=short", "CORS_ORIGIN=*"]:
            result = self.run(["run", "--rm", "--no-deps", "--entrypoint", "php", "-e", override,
                               "api", "/usr/local/lib/kitchenware/preflight.php"], check=False)
            if result.returncode == 0 or any(secret in result.stdout + result.stderr for secret in self.secrets):
                raise AssertionError("Preflight debe fallar sin revelar valores sensibles")
        self.ok("Errores de preflight sin valores sensibles")

    def cleanup(self):
        if self.started:
            # No --volumes: conservar incluso los volúmenes exclusivos de esta prueba.
            self.run(["down"], timeout=60)
            print("Volúmenes de prueba conservados; proyecto: " + self.project, flush=True)


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()
    with tempfile.TemporaryDirectory(prefix="kitchenware-infra-verification-") as directory:
        check = Verification(directory)
        failed = False
        try:
            check.execute()
        except Exception as error:
            failed = True
            print("FAIL: " + check.redact(str(error)), flush=True)
            if check.started:
                logs = check.run(["logs", "--no-color", "--tail", "20"], check=False)
                print(check.redact(logs.stdout + logs.stderr), flush=True)
        finally:
            try:
                check.cleanup()
                check.verify_preservation()
            except Exception as error:
                failed = True
                print("FAIL: " + check.redact(str(error)), flush=True)
        if failed:
            raise SystemExit(1)
        print(f"Resultado: {check.passed} comprobaciones aprobadas, 0 fallidas.", flush=True)


if __name__ == "__main__":
    main()
