from dataclasses import dataclass, field
from datetime import timezone
from email.utils import parsedate_to_datetime
import json
import re
import urllib.error
import urllib.request

from .config import ToolError

CODES = {
    "VALIDATION_ERROR",
    "INVALID_DATE_RANGE",
    "INVALID_CREDENTIALS",
    "FORBIDDEN_ROLE",
    "NOT_FOUND",
    "REFERENCE_TAKEN",
    "DOCUMENT_TAKEN",
    "ARTICLE_NOT_AVAILABLE",
    "ARTICLE_HAS_OPEN_LOANS",
    "NEIGHBOR_LIMIT_EXCEEDED",
    "DUPLICATE_ARTICLE_IN_LOAN",
    "NEIGHBOR_HAS_OVERDUE",
    "ITEM_ALREADY_RETURNED",
    "USERNAME_TAKEN",
}


@dataclass
class Response:
    status: int
    body: object = field(repr=False)
    date: str | None = None

    @property
    def code(self):
        value = self.body.get("code") if isinstance(self.body, dict) else None
        return value if isinstance(value, str) and value in CODES else "HTTP_ERROR"

    def server_time(self):
        try:
            value = parsedate_to_datetime(self.date)
            if value.utcoffset() is None:
                raise ValueError()
            return value.astimezone(timezone.utc)
        except (ValueError, TypeError, AttributeError):
            raise ToolError(
                "No se pudo obtener una fecha UTC válida del encabezado Date del servidor."
            ) from None


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, message, headers, newurl):
        raise ToolError("Se rechazó una redirección; no se reenviarán credenciales a otro destino.")


class Client:
    def __init__(self, config):
        self.config = config
        self._token = None
        self._opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def request(self, method, path, payload=None, authenticated=True):
        if not re.fullmatch(r"/[a-zA-Z0-9/_?=&%+.-]+", path) or ".." in path.split("?")[0]:
            raise ToolError("Ruta HTTP no permitida.")
        data = None if payload is None else json.dumps(payload).encode()
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = "application/json"
        if authenticated and self._token:
            headers["Authorization"] = "Bearer " + self._token
        request = urllib.request.Request(
            self.config.url + path, data=data, method=method, headers=headers
        )
        try:
            try:
                result = self._opener.open(request, timeout=self.config.timeout)
            except urllib.error.HTTPError as error:
                result = error
            with result:
                raw = result.read(2097153)
                if len(raw) > 2097152:
                    raise ToolError(
                        "La respuesta excede el límite; no se reintentará la solicitud."
                    )
                body = None if result.status == 204 else json.loads(raw)
                return Response(result.status, body, result.headers.get("Date"))
        except ToolError:
            raise
        except Exception:
            raise ToolError(
                "Falló la comunicación HTTP o su respuesta. El resultado de una escritura puede ser incierto; no se reintenta automáticamente."
            ) from None

    def login(self):
        if not self.config.username or not self.config.password:
            raise ToolError(
                "Define las credenciales administrativas mediante variables de entorno."
            )
        result = self.request(
            "POST",
            "/auth/login",
            {"username": self.config.username, "password": self.config.password},
            authenticated=False,
        )
        body = result.body
        if (
            result.status != 200
            or not isinstance(body, dict)
            or body.get("role") != "admin"
            or body.get("token_type") != "Bearer"
            or body.get("expires_in") != 28800
            or not isinstance(body.get("access_token"), str)
            or not body["access_token"]
        ):
            raise ToolError("No se pudo autenticar como administrador conforme al contrato JWT.")
        self._token = body["access_token"]
