#!/usr/bin/env python3
"""Auditar una instalación NUEVA aislada configurada en infra/.env; conservar recursos."""

import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import secrets
import stat
import subprocess
import time

INFRA = Path(__file__).resolve().parents[1]
ROOT = INFRA.parent
spec = importlib.util.spec_from_file_location("stack_checks", INFRA / "tests/verify-stack.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class Delivery(module.Verification):
    def __init__(self):
        path = INFRA / ".env"
        metadata = path.lstat()
        if not stat.S_ISREG(metadata.st_mode) or stat.S_IMODE(metadata.st_mode) != 0o600:
            raise RuntimeError("Se requiere .env regular privado 0600.")
        self.env = {}
        for line in path.read_text().splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            key, separator, value = line.partition("=")
            if not separator or not re.fullmatch(r"[A-Z][A-Z0-9_]*", key):
                raise RuntimeError("Configuración local inválida.")
            self.env[key] = value.strip().strip("\"'")
        required = [
            "ADMIN_PASSWORD",
            "ADMIN_USERNAME",
            "APP_KEY",
            "POSTGRES_PASSWORD",
            "JWT_SECRET",
        ]
        if not all(self.env.get(key) for key in required):
            raise RuntimeError("Faltan variables obligatorias.")
        self.project = self.env.get("COMPOSE_PROJECT_NAME", "")
        if not re.fullmatch(r"kitchenware-delivery-[a-f0-9]{12}", self.project):
            raise RuntimeError("Se requiere un proyecto nuevo kitchenware-delivery-<12 hex>.")
        self.admin_password = self.env["ADMIN_PASSWORD"]
        self.secrets = [self.env[key] for key in required]
        self.process_env = {
            key: value
            for key, value in os.environ.items()
            if key not in self.env
            and not key.startswith(
                ("COMPOSE_", "POSTGRES_", "APP_", "API_", "DB_", "JWT_", "ADMIN_", "VITE_")
            )
        }
        self.compose = [
            "docker",
            "compose",
            "--env-file",
            str(path),
            "--project-name",
            self.project,
            "--file",
            str(INFRA / "compose.yaml"),
            "--file",
            str(INFRA / "compose.app.yaml"),
        ]
        self.passed = 0
        self.started = False
        self.baseline = None

    def wait_all(self):
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            raw = self.run(["ps", "--format", "json"], timeout=15).stdout.strip()
            rows = (
                json.loads(raw)
                if raw.startswith("[")
                else [json.loads(line) for line in raw.splitlines()]
            )
            if len(rows) == 3 and all(row.get("Health") == "healthy" for row in rows):
                self.base = "http://" + self.run(["port", "app", "8080"]).stdout.strip()
                return
            time.sleep(1)
        raise RuntimeError("Los tres servicios no alcanzaron estado healthy.")

    def execute_delivery(self, browser, existing=False, restart_owned=False):
        self.baseline = self.snapshot()
        found = [
            row
            for row in self.baseline[0].values()
            if row["name"].lstrip("/").startswith(self.project + "-")
        ]
        if not existing and (
            found or any(name.startswith(self.project + "_") for name in self.baseline[1])
        ):
            raise RuntimeError("El proyecto ya existe; no se reemplazarán sus servicios o datos.")
        if existing and len(found) != 3:
            raise RuntimeError(
                "La revisión existente requiere los tres contenedores del proyecto aislado."
            )
        if existing and restart_owned:
            # Solo el proyecto aislado explícitamente autorizado puede reiniciarse.
            # Todos los otros contenedores siguen en la comparación final.
            own_ids = {row["id"] for row in found}
            self.baseline = (
                {key: row for key, row in self.baseline[0].items() if key not in own_ids},
                self.baseline[1],
                self.baseline[2],
            )
        config = json.loads(self.run(["config", "--format", "json"]).stdout)
        services = config["services"]
        self.ok(
            "Tres servicios y PostgreSQL 16",
            set(services) == {"postgres", "api", "app"}
            and services["postgres"]["image"] == "postgres:16",
        )
        self.ok(
            "PostgreSQL sin puerto host; volúmenes y red exclusivos",
            not services["postgres"].get("ports")
            and config["networks"]["database"]["internal"]
            and all(
                row["name"].startswith(self.project + "_") for row in config["volumes"].values()
            ),
        )
        self.ok(
            "Sin montajes de fuentes o directorios reales",
            all(
                row["type"] == "volume"
                for service in services.values()
                for row in service.get("volumes", [])
            ),
        )
        self.ok(
            "Puertos web distintos de PostgreSQL, publicados solo en loopback",
            all(
                row["host_ip"] == "127.0.0.1" and int(row["published"]) not in [0, 5432]
                for service in ["api", "app"]
                for row in services[service]["ports"]
            ),
        )
        if not existing:
            print(
                "Construyendo e iniciando únicamente el proyecto nuevo: " + self.project, flush=True
            )
            self.run(["up", "--build", "-d"], timeout=900)
            self.started = True
        self.wait_all()
        self.ok("PostgreSQL, API y React/Nginx saludables")
        bootstrap = (
            'require "vendor/autoload.php"; $app = require "bootstrap/app.php"; '
            "$app->make(Illuminate\\Contracts\\Console\\Kernel::class)->bootstrap(); "
        )
        data = json.loads(
            self.php(
                bootstrap + "echo json_encode([PHP_VERSION_ID, app()->version(), "
                'DB::selectOne("SELECT current_database() AS name")->name, DB::table("migrations")->count(), '
                'DB::table("category")->count(), DB::table("user")->count(), '
                "DB::selectOne(\"SELECT current_setting('TimeZone') AS zone\")->zone]);"
            )
        )
        self.ok(
            "PHP 8.4, Laravel 12, UTC, seis migraciones y cinco categorías",
            80400 <= data[0] < 80500
            and data[1].startswith("12.")
            and data[2] == self.env["POSTGRES_DB"]
            and data[3:5] == [6, 5]
            and data[5] >= 1
            and data[6] == "UTC",
        )
        self.login()
        status, body, _ = self.request("GET", "/api/v1/health")
        self.ok("Proxy Nginx hacia Laravel", status == 200 and json.loads(body) == {"status": "ok"})
        self.ok(
            "Lectura de inventario sin JWT rechazada",
            self.request("GET", "/api/v1/articles")[0] == 401,
        )
        categories = json.loads(self.request("GET", "/api/v1/categories", token=self.token)[1])
        status, body, _ = self.request(
            "POST",
            "/api/v1/articles",
            {
                "name": "Comprobación aislada de entrega",
                "description": "Datos sintéticos propios",
                "reference": "DELIVERY-" + secrets.token_hex(5),
                "category_id": categories[0]["id"],
                "total_units": 2,
            },
            token=self.token,
        )
        self.ok("Registro HTTP en base propia", status == 201)
        article = json.loads(body)["id"]
        image = self.png()
        boundary = "Delivery" + secrets.token_hex(8)
        payload = (
            (
                f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="../../cover.png"\r\n'
                "Content-Type: image/png\r\n\r\n"
            ).encode()
            + image
            + f"\r\n--{boundary}--\r\n".encode()
        )
        cover = f"/api/v1/articles/{article}/cover"
        status, body, _ = self.request(
            "PUT", cover, payload, self.token, "multipart/form-data; boundary=" + boundary
        )
        key = json.loads(body).get("cover_key", "")
        self.ok(
            "Imagen a través de Nginx con clave opaca",
            status == 200 and re.fullmatch(r"[a-f0-9]{64}\.png", key) is not None,
        )
        self.ok(
            "Permisos privados 0700/0600",
            self.php(
                'echo json_encode([decoct(fileperms(getenv("COVERS_DIR")) & 0777), decoct(fileperms(getenv("COVERS_DIR")."/'
                + key
                + '") & 0777)]);'
            )
            == '["700","600"]',
        )
        self.ok(
            "Descarga autenticada preserva bytes",
            self.request("GET", cover, token=self.token)[:2] == (200, image),
        )
        public_index = self.request("GET", "/")[1]
        direct = self.request("GET", "/storage/" + key)
        self.ok(
            "Imagen privada sin JWT y sin publicación directa",
            self.request("GET", cover)[0] == 401
            and (
                direct[0] == 404
                or (
                    direct[0] == 200
                    and direct[1] == public_index
                    and direct[2].get("Content-Type", "").startswith("text/html")
                )
            ),
        )
        status, _, headers = self.request(
            "OPTIONS",
            "/api/v1/articles",
            extra_headers={
                "Origin": self.env["CORS_ORIGIN"],
                "Access-Control-Request-Method": "GET",
            },
        )
        self.ok(
            "Origen CORS local exacto",
            status == 204 and headers.get("Access-Control-Allow-Origin") == self.env["CORS_ORIGIN"],
        )
        self.ok(
            "React/Nginx sin root",
            int(self.run(["exec", "-T", "app", "id", "-u"]).stdout.strip()) > 0,
        )
        # Solo estos servicios se crearon en esta ejecución. No se recrean ni eliminan.
        if not existing or restart_owned:
            self.run(["stop", "app", "api", "postgres"])
            self.run(["start", "postgres", "api", "app"])
            self.wait_all()
            self.ok(
                "Datos, JWT e imagen persisten tras stop/start propio",
                self.request("GET", cover, token=self.token)[:2] == (200, image),
            )
            self.ok(
                "Inicialización repetida conserva administrador y categorías",
                self.php(
                    bootstrap
                    + 'echo json_encode([DB::table("migrations")->count(), DB::table("category")->count(), DB::table("user")->count()]);'
                )
                == "[6,5,1]",
            )
        if browser:
            env = {
                key: value
                for key, value in os.environ.items()
                if not key.startswith(("VITE_", "KITCHENWARE_TEST_"))
            }
            env.update(
                {
                    "KITCHENWARE_TEST_URL": self.base,
                    "KITCHENWARE_TEST_USERNAME": self.env["ADMIN_USERNAME"],
                    "KITCHENWARE_TEST_PASSWORD": self.admin_password,
                }
            )
            result = subprocess.run(
                [
                    "node",
                    "node_modules/@playwright/test/cli.js",
                    "test",
                    "--config",
                    "playwright.docker.config.ts",
                ],
                cwd=ROOT / "app",
                env=env,
                capture_output=True,
                text=True,
                timeout=180,
            )
            count = re.search(r"(\d+) passed", re.sub(r"\x1b\[[0-9;]*m", "", result.stdout))
            if result.returncode or not count:
                raise RuntimeError(
                    "Navegador no aprobado; salida omitida para proteger credenciales."
                )
            self.ok(
                "Navegador real: "
                + count.group(1)
                + " prueba(s), imágenes, reporte histórico, operador y permisos"
            )
        logs = self.run(["logs", "--no-color"]).stdout
        self.ok(
            "Logs sin secretos configurados ni JWT conocido",
            all(secret not in logs for secret in self.secrets),
        )
        print("Servicios propios conservados saludables: " + self.project, flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--browser", action="store_true")
    parser.add_argument(
        "--existing",
        action="store_true",
        help="Revisar solo el proyecto aislado configurado, sin construir, arrancar ni reiniciar servicios; crea fixtures HTTP propios.",
    )
    parser.add_argument(
        "--restart-owned",
        action="store_true",
        help="Autorizar stop/start únicamente de los tres servicios aislados configurados para verificar persistencia.",
    )
    args = parser.parse_args()
    check = None
    failed = False
    try:
        check = Delivery()
        check.execute_delivery(args.browser, args.existing, args.restart_owned)
    except Exception:
        failed = True
        print(
            "FAIL: auditoría no completada; salida sensible omitida. No se eliminan ni reemplazan recursos.",
            flush=True,
        )
    finally:
        if check is not None:
            try:
                check.verify_preservation()
            except Exception:
                failed = True
                print("FAIL: no se acreditó preservación de recursos previos.", flush=True)
    print(json.dumps({"passed_checks": check.passed if check else 0, "failed": failed}))
    return int(failed)


if __name__ == "__main__":
    raise SystemExit(main())
