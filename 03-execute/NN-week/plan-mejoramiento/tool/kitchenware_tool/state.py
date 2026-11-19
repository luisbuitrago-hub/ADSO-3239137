import fcntl
import json
import os
import re
import stat
import uuid

from .config import ToolError

UUID = re.compile(r"^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$", re.I)


def identifier(value):
    if not isinstance(value, str) or not UUID.fullmatch(value):
        raise ToolError("La respuesta o el recibo contiene un UUID inválido.")
    return value.lower()


def project(kind, body):
    """Lista blanca: ningún cuerpo bruto, contraseña o token llega al recibo."""
    if kind == "article":
        return {"id": identifier(body["id"])}
    if kind == "neighbor":
        return {"id": identifier(body["id"])}
    if kind == "loan":
        items = body["items"]
        if not isinstance(items, list) or not 1 <= len(items) <= 3:
            raise ToolError("Préstamo no compatible con el contrato.")
        return {
            "id": identifier(body["id"]),
            "neighbor_id": identifier(body["neighbor_id"]),
            "loaned_at": body["loaned_at"],
            "items": [
                {
                    "id": identifier(item["id"]),
                    "article_id": identifier(item["article_id"]),
                    "due_at": item["due_at"],
                }
                for item in items
            ],
        }
    return None


class Journal:
    def __init__(self, config, create=False):
        self.config = config
        self.file = None
        self.events = []
        try:
            if create:
                config.state.parent.mkdir(parents=True, exist_ok=True)
            flags = os.O_RDWR | os.O_NOFOLLOW | (os.O_CREAT | os.O_EXCL if create else 0)
            descriptor = os.open(config.state, flags, 0o600)
            self.file = os.fdopen(descriptor, "r+", encoding="utf-8")
            if (
                not stat.S_ISREG(os.fstat(descriptor).st_mode)
                or os.fstat(descriptor).st_mode & 0o077
            ):
                raise ToolError("El recibo debe ser un archivo regular privado (0600).")
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
            for line in self.file:
                self.events.append(json.loads(line))
            if create:
                self.append(
                    {
                        "type": "header",
                        "version": 1,
                        "url": config.url,
                        "run_id": uuid.uuid4().hex[:12],
                        "articles": config.articles,
                    }
                )
            header = self.events[0]
            if (
                header.get("type") != "header"
                or header.get("version") != 1
                or header.get("url") != config.url
                or not re.fullmatch("[a-f0-9]{12}", header.get("run_id", ""))
                or not isinstance(header.get("articles"), int)
                or not 40 <= header["articles"] <= 5000
            ):
                raise ToolError(
                    "Recibo incompatible o destino distinto; no se ejecutará sobre otra API."
                )
            self.header = header
        except ToolError:
            self.close()
            raise
        except Exception:
            self.close()
            raise ToolError(
                "No se pudo abrir un recibo exclusivo, válido y desbloqueado. No se sobrescribirá ni reparará automáticamente."
            ) from None

    @property
    def prefix(self):
        return "KW-" + self.header["run_id"].upper()

    @property
    def pending(self):
        pending = set()
        for event in self.events:
            if event["type"] == "intent":
                pending.add(event["key"])
            elif event["type"] == "outcome":
                pending.discard(event["key"])
        return pending

    def outcomes(self, kind):
        return [
            event
            for event in self.events
            if event["type"] == "outcome"
            and event.get("kind") == kind
            and 200 <= event["status"] < 300
            and event.get("resource")
        ]

    def resource(self, key):
        for event in reversed(self.events):
            if event["type"] == "outcome" and event["key"] == key and event.get("resource"):
                return event["resource"]
        raise ToolError("Falta un recurso confirmado en el recibo.")

    def append(self, event):
        self.file.seek(0, os.SEEK_END)
        self.file.write(json.dumps(event, ensure_ascii=True, separators=(",", ":")) + "\n")
        self.file.flush()
        os.fsync(self.file.fileno())
        self.events.append(event)

    def close(self):
        if self.file is not None:
            self.file.close()
            self.file = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()
