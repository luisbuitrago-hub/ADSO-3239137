from dataclasses import dataclass, field
from pathlib import Path
import ipaddress
import os
from urllib.parse import urlsplit


class ToolError(Exception):
    """Error público: nunca adjuntar respuestas o credenciales."""


def base_url(value):
    try:
        parts = urlsplit(value)
        port = parts.port
        if (
            parts.scheme not in ("http", "https")
            or not parts.hostname
            or parts.username
            or parts.password
            or parts.query
            or parts.fragment
            or parts.path.rstrip("/") != "/api/v1"
            or any(c.isspace() or ord(c) < 32 for c in value)
            or "\\" in value
        ):
            raise ValueError()
        if parts.scheme == "http":
            local = parts.hostname == "localhost"
            try:
                local = local or ipaddress.ip_address(parts.hostname).is_loopback
            except ValueError:
                pass
            if not local:
                raise ValueError()
        if port == 0:
            raise ValueError()
        return value.rstrip("/")
    except (ValueError, TypeError):
        raise ToolError(
            "Define una URL /api/v1 sin credenciales, parámetros ni fragmentos; HTTP solo en loopback."
        ) from None


@dataclass(frozen=True)
class Config:
    url: str
    state: Path
    username: str = field(repr=False)
    password: str = field(repr=False)
    confirmation: str = ""
    acknowledgement: str = ""
    articles: int = 40
    timeout: float = 15

    @classmethod
    def read(cls, env=None):
        env = os.environ if env is None else env
        url = base_url(env.get("KITCHENWARE_API_URL", ""))
        if not env.get("KITCHENWARE_STATE"):
            raise ToolError("Define KITCHENWARE_STATE para un recibo exclusivo de esta ejecución.")
        try:
            count = int(env.get("KITCHENWARE_ARTICLE_COUNT", "40"))
            timeout = float(env.get("KITCHENWARE_HTTP_TIMEOUT", "15"))
            if not 40 <= count <= 5000 or not 1 <= timeout <= 120:
                raise ValueError()
        except ValueError:
            raise ToolError(
                "Cantidad permitida: 40–5000 artículos; timeout: 1–120 segundos."
            ) from None
        return cls(
            url,
            Path(env["KITCHENWARE_STATE"]),
            env.get("KITCHENWARE_ADMIN_USERNAME", ""),
            env.get("KITCHENWARE_ADMIN_PASSWORD", ""),
            env.get("KITCHENWARE_CONFIRM_TARGET", ""),
            env.get("KITCHENWARE_WRITE_ACK", ""),
            count,
            timeout,
        )

    def allow_writes(self):
        if self.confirmation != self.url or self.acknowledgement != "isolated-demo":
            raise ToolError(
                "Escrituras bloqueadas: confirma el destino exacto y KITCHENWARE_WRITE_ACK=isolated-demo en un entorno autorizado."
            )
