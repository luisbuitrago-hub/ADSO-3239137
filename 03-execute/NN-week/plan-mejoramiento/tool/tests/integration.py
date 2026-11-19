#!/usr/bin/env python3
"""API/PostgreSQL propios; credenciales solo en memoria, sin SQL ni Docker down/rm/prune."""

import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import time

TOOL = Path(__file__).resolve().parents[1]
ROOT = TOOL.parent


class IntegrationError(Exception):
    pass


class IsolatedStack:
    def __init__(self):
        self.project = "kitchenware-tool-test-" + secrets.token_hex(6)
        self.credentials = [secrets.token_hex(32) for _ in range(3)]
        password, jwt, admin = self.credentials
        self.env = {
            key: value
            for key, value in os.environ.items()
            if not key.startswith(
                (
                    "COMPOSE_",
                    "KITCHENWARE_",
                    "POSTGRES_",
                    "ADMIN_",
                    "APP_",
                    "API_",
                    "DB_",
                    "JWT_",
                    "VITE_",
                )
            )
        }
        self.env.update(
            {
                "POSTGRES_DB": "kitchenware_tool_test",
                "POSTGRES_USER": "kitchenware_tool_test",
                "POSTGRES_PASSWORD": password,
                "JWT_SECRET": jwt,
                "ADMIN_USERNAME": "tool_integration",
                "ADMIN_PASSWORD": admin,
                "APP_KEY": "base64:" + base64.b64encode(secrets.token_bytes(32)).decode(),
                "API_BIND_ADDRESS": "127.0.0.1",
                "API_PORT": "0",
                "CORS_ORIGIN": "http://localhost:5173",
            }
        )
        self.compose = [
            "docker",
            "compose",
            "--env-file",
            "/dev/null",
            "--project-name",
            self.project,
            "--file",
            str(ROOT / "infra/compose.yaml"),
        ]
        self.started = False
        self.before = None
        self.output = TOOL / ".runs" / self.project
        self.output.mkdir(parents=True, mode=0o700)

    def run(self, args, compose=True, timeout=900):
        result = subprocess.run(
            (self.compose if compose else []) + args,
            env=self.env,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        if result.returncode:
            # No imprimir entornos, logs de servidor, argumentos sensibles ni respuestas.
            raise IntegrationError(
                "Falló una operación del entorno Docker aislado; no se publican diagnósticos con posibles credenciales."
            )
        return result.stdout

    def snapshot(self):
        ids = self.run(["docker", "ps", "-aq", "--no-trunc"], compose=False).split()
        containers = {}
        if ids:
            template = (
                '{"id":{{json .Id}},"name":{{json .Name}},"started":{{json .State.StartedAt}},'
                '"running":{{json .State.Running}},"restarts":{{json .RestartCount}},'
                '"ports":{{json .HostConfig.PortBindings}},"mounts":{{json .Mounts}}}'
            )
            rows = self.run(["docker", "inspect", "--format", template, *ids], compose=False)
            containers = {row["id"]: row for row in map(json.loads, rows.splitlines())}
        names = self.run(["docker", "volume", "ls", "-q"], compose=False).split()
        volumes = {}
        if names:
            template = (
                '{"name":{{json .Name}},"created":{{json .CreatedAt}},"driver":{{json .Driver}}}'
            )
            rows = self.run(
                ["docker", "volume", "inspect", "--format", template, *names], compose=False
            )
            volumes = {row["name"]: row for row in map(json.loads, rows.splitlines())}
        files = {
            str(path): hashlib.sha256(path.read_bytes()).digest() if path.exists() else None
            for path in [ROOT / "api/.env", ROOT / "infra/.env"]
        }
        return containers, volumes, files

    def start(self):
        # El constructor elegido es una preparación explícita; arrancarlo antes de
        # capturar servicios/datos previos permite reutilizar su caché detenida.
        builder = self.env.get("BUILDX_BUILDER")
        if builder:
            self.run(["docker", "buildx", "inspect", "--bootstrap", builder], compose=False)
        self.before = self.snapshot()
        config = json.loads(self.run(["config", "--format", "json"]))
        if set(config["services"]) != {"api", "postgres"}:
            raise IntegrationError("Servicios inesperados; no se inicia el proyecto.")
        if not all(
            row["name"].startswith(self.project + "_") for row in config["volumes"].values()
        ):
            raise IntegrationError("Volúmenes no exclusivos; ejecución bloqueada.")
        if any(
            row.get("type") != "volume"
            for service in config["services"].values()
            for row in service.get("volumes", [])
        ):
            raise IntegrationError("Montajes no exclusivos; ejecución bloqueada.")
        if config["services"]["api"]["ports"][0]["published"] != "0":
            raise IntegrationError("El puerto de API debe ser aleatorio.")
        if any(
            row["name"].lstrip("/").startswith(self.project + "-")
            for row in self.before[0].values()
        ) or any(name.startswith(self.project + "_") for name in self.before[1]):
            raise IntegrationError("El proyecto ya existe; no se reutilizará.")
        print("Construyendo API y PostgreSQL exclusivos de prueba...", flush=True)
        self.started = True
        self.run(["up", "--build", "-d"])
        deadline = time.monotonic() + 180
        while time.monotonic() < deadline:
            raw = self.run(["ps", "--format", "json"], timeout=15).strip()
            rows = (
                json.loads(raw)
                if raw.startswith("[")
                else [json.loads(line) for line in raw.splitlines()]
            )
            if len(rows) == 2 and all(row.get("Health") == "healthy" for row in rows):
                self.url = "http://" + self.run(["port", "api", "8080"]).strip() + "/api/v1"
                return
            time.sleep(1)
        raise IntegrationError("Los servicios de prueba no alcanzaron estado healthy.")

    def command(self, command, state, articles=40, expected=0, apply=False):
        env = {
            key: value for key, value in os.environ.items() if not key.startswith("KITCHENWARE_")
        }
        env.update(
            {
                "KITCHENWARE_API_URL": self.url,
                "KITCHENWARE_STATE": str(state),
                "KITCHENWARE_ADMIN_USERNAME": self.env["ADMIN_USERNAME"],
                "KITCHENWARE_ADMIN_PASSWORD": self.env["ADMIN_PASSWORD"],
                "KITCHENWARE_CONFIRM_TARGET": self.url,
                "KITCHENWARE_WRITE_ACK": "isolated-demo",
                "KITCHENWARE_ARTICLE_COUNT": str(articles),
            }
        )
        args = [sys.executable, str(TOOL / "kitchenware.py"), command] + (
            ["--apply"] if apply else []
        )
        result = subprocess.run(args, env=env, capture_output=True, text=True, timeout=900)
        allowed = (expected,) if isinstance(expected, int) else expected
        if result.returncode not in allowed:
            # Los mensajes del CLI son deliberadamente sanitizados; volver a filtrarlos.
            message = result.stderr
            for secret in self.credentials + [self.env["APP_KEY"]]:
                message = message.replace(secret, "[REDACTED]")
            raise IntegrationError(f"Falló {command}: " + message[:700])
        try:
            body = json.loads(result.stdout.splitlines()[-1])
        except Exception:
            raise IntegrationError("El comando no produjo un resumen verificable.") from None
        for secret in self.credentials + [self.env["APP_KEY"]]:
            if secret in result.stdout or secret in result.stderr or secret in state.read_text():
                raise IntegrationError("Se detectó una credencial en un artefacto de prueba.")
        return body, result.returncode

    def stop_and_preserve(self):
        if self.started:
            # Solo stop: se conservan contenedores, redes, imágenes, datos y volúmenes.
            self.run(["stop"])
            print(
                "Servicios propios detenidos; contenedores, redes y volúmenes conservados: "
                + self.project,
                flush=True,
            )
        if self.before is not None:
            current = self.snapshot()
            if not all(current[0].get(key) == row for key, row in self.before[0].items()):
                raise IntegrationError("Cambió un contenedor previo.")
            if (
                not all(current[1].get(key) == row for key, row in self.before[1].items())
                or current[2] != self.before[2]
            ):
                raise IntegrationError("Cambió un volumen previo o un archivo .env.")
            print("PASS: contenedores/volúmenes previos y .env conservados.", flush=True)


def require(condition, name):
    if not condition:
        raise IntegrationError("Falló la comprobación de integración: " + name)
    print("PASS: " + name, flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--performance",
        action="store_true",
        help="Sembrar otros 5000 artículos por HTTP y medir RNF-1.",
    )
    options = parser.parse_args()
    stack = IsolatedStack()
    evidence = {"project": stack.project}
    try:
        stack.start()
        state = stack.output / "demo.jsonl"
        demo, _ = stack.command("seed", state)
        evidence["demo"] = demo
        require(
            demo["complete_demo"]
            and (demo["articles_created"], demo["neighbors_created"], demo["loans_created"])
            == (40, 10, 15),
            "40 artículos, 10 vecinos y 15 préstamos creados por HTTP",
        )
        require(
            demo["pending_lines"] == 3 and demo["report_lines"] == 16,
            "tres líneas pendientes y reporte histórico con resultados",
        )
        # No reusar el recibo ni duplicar un seed completado.
        repeat = subprocess.run(
            [sys.executable, str(TOOL / "kitchenware.py"), "seed"],
            env={
                **os.environ,
                "KITCHENWARE_API_URL": stack.url,
                "KITCHENWARE_STATE": str(state),
                "KITCHENWARE_CONFIRM_TARGET": stack.url,
                "KITCHENWARE_WRITE_ACK": "isolated-demo",
            },
            capture_output=True,
            text=True,
        )
        require(repeat.returncode == 1, "repetición bloqueada antes de escribir")
        overdue, _ = stack.command("overdue", state, expected=2)
        evidence["overdue_initial"] = overdue
        require(
            not overdue["minimum_met"] and overdue["own_overdue_lines"] == 0,
            "no se inventan vencidos antes del plazo real",
        )
        plan, _ = stack.command("cleanup", state)
        verified, _ = stack.command("verify", state)
        require(
            plan["lines_to_return"] == 3 and verified["pending_lines"] == 3,
            "limpieza sin --apply es solo consulta",
        )
        stack.command("cleanup", state, apply=True)
        cleaned, _ = stack.command("verify", state)
        evidence["after_cleanup"] = cleaned
        require(
            cleaned["active_articles"] == 0
            and cleaned["pending_lines"] == 0
            and cleaned["neighbors_created"] == 10
            and cleaned["loans_created"] == 15
            and cleaned["report_lines"] == 16,
            "devoluciones y bajas propias conservan vecinos, préstamos e historial",
        )
        again, _ = stack.command("cleanup", state, apply=True)
        require(
            again["lines_to_return"] == 0 and again["articles_to_deactivate"] == 0,
            "limpieza repetida sin duplicar devoluciones",
        )
        result_code = 0
        if options.performance:
            print("Sembrando 5000 artículos por HTTP; no se usa SQL directo...", flush=True)
            performance = stack.output / "performance.jsonl"
            dataset, _ = stack.command("seed", performance, articles=5000)
            evidence["performance_dataset"] = dataset
            require(
                dataset["articles_created"] == 5000 and dataset["complete_demo"],
                "5000 artículos HTTP activos en el segundo conjunto",
            )
            measured, result_code = stack.command("benchmark", performance, expected=(0, 2))
            evidence["benchmark"] = measured
            print(
                "Medición HTTP (sin credenciales): " + json.dumps(measured, sort_keys=True),
                flush=True,
            )
        # Evidencia limitada a conteos/fechas/métricas, sin entornos o respuestas de login.
        path = stack.output / "results.json"
        with open(
            path, "x", encoding="utf-8", opener=lambda name, flags: os.open(name, flags, 0o600)
        ) as file:
            json.dump(evidence, file, indent=2)
        print("Evidencia local privada: " + str(path), flush=True)
        return result_code
    finally:
        stack.stop_and_preserve()


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (IntegrationError, KeyboardInterrupt) as error:
        print(
            "ERROR: "
            + (
                str(error)
                if isinstance(error, IntegrationError)
                else "Integración interrumpida; recursos propios conservados."
            ),
            file=sys.stderr,
        )
        raise SystemExit(1)
