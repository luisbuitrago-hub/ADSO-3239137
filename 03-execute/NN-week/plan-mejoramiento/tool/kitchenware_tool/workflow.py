from datetime import datetime, timedelta, timezone
import math
import statistics
import time
from urllib.parse import urlencode

from .config import ToolError
from .state import identifier, project


def utc(value):
    try:
        if not isinstance(value, str) or not value.endswith("Z"):
            raise ValueError()
        result = datetime.fromisoformat(value[:-1] + "+00:00")
        if result.utcoffset() != timedelta(0):
            raise ValueError()
        return result
    except (ValueError, TypeError):
        raise ToolError("Fecha no compatible con el contrato UTC.") from None


def iso(value):
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class Workflow:
    def __init__(self, config, client, journal, progress=lambda message: None):
        self.config = config
        self.client = client
        self.journal = journal
        self.progress = progress
        self.checks = 0

    def require(self, condition, label):
        if not condition:
            raise ToolError("No se cumple la comprobación: " + label)
        self.checks += 1

    def get(self, path):
        response = self.client.request("GET", path)
        self.require(response.status == 200, "consulta HTTP 200")
        return response.body

    def write(self, key, kind, method, path, payload=None, status=201, code=None):
        self.config.allow_writes()
        if self.journal.pending:
            raise ToolError(
                "Hay una escritura de resultado incierto: reconciliar el recibo antes de continuar."
            )
        self.journal.append({"type": "intent", "key": key})
        response = self.client.request(method, path, payload)
        resource = None
        if response.status in (200, 201) and kind in ("article", "neighbor", "loan"):
            resource = project(kind, response.body)
            if kind == "loan":
                utc(resource["loaned_at"])
                for item in resource["items"]:
                    utc(item["due_at"])
        self.journal.append(
            {
                "type": "outcome",
                "key": key,
                "kind": kind,
                "status": response.status,
                "code": response.code if response.status >= 400 else None,
                "resource": resource,
            }
        )
        self.require(
            response.status == status and (code is None or response.code == code),
            "estado/código HTTP esperado en " + key,
        )
        return response.body

    def article_payload(self, index, category):
        return {
            "name": f"Demostración {self.journal.prefix} utensilio {index:04}",
            "description": f"Datos sintéticos de demostración {self.journal.prefix}.",
            "reference": f"{self.journal.prefix}-{index:04}",
            "category_id": category,
            "total_units": 1 if index == 0 else 3,
        }

    def lend_payload(self, neighbor, articles):
        return {"neighbor_id": neighbor, "items": [{"article_id": article} for article in articles]}

    def seed(self):
        categories = self.get("/categories")
        self.require(
            isinstance(categories, list)
            and {row["name"] for row in categories}
            == {"ollas", "vajilla", "cubiertos", "hornillas", "manteles"},
            "cinco categorías documentadas",
        )
        ids = [identifier(row["id"]) for row in categories]
        articles = []
        for index in range(self.journal.header["articles"]):
            body = self.write(
                f"article:{index}",
                "article",
                "POST",
                "/articles",
                self.article_payload(index, ids[index % 5]),
            )
            self.require(body["available_units"] == body["total_units"], "inventario inicial")
            articles.append(body)
            if (index + 1) % 1000 == 0:
                self.progress(f"Artículos creados por HTTP: {index + 1}")
        neighbors = []
        for index in range(10):
            neighbors.append(
                self.write(
                    f"neighbor:{index}",
                    "neighbor",
                    "POST",
                    "/neighbors",
                    {
                        "full_name": f"Vecino demostración {self.journal.prefix} {index:02}",
                        "document_number": f"{self.journal.prefix}-N{index:02}",
                    },
                )
            )
        loans = []
        for index in range(15):
            selected = [articles[index]["id"]]
            if index == 0:
                selected.append(articles[15]["id"])
            loan = self.write(
                f"loan:{index}",
                "loan",
                "POST",
                "/loans",
                self.lend_payload(neighbors[index % 10]["id"], selected),
            )
            self.require(len(loan["items"]) == len(selected), "una unidad por línea")
            self.require(
                all(
                    utc(item["due_at"]) - utc(loan["loaned_at"]) == timedelta(days=3)
                    for item in loan["items"]
                ),
                "tres días exactos",
            )
            loans.append(loan)
        a = lambda index: articles[index]["id"]
        n = lambda index: neighbors[index]["id"]
        self.write(
            "error:reference",
            "article",
            "POST",
            "/articles",
            self.article_payload(0, ids[0]),
            status=409,
            code="REFERENCE_TAKEN",
        )
        self.write(
            "error:document",
            "neighbor",
            "POST",
            "/neighbors",
            {
                "full_name": "Vecino de demostración duplicado",
                "document_number": neighbors[0]["document_number"],
            },
            status=409,
            code="DOCUMENT_TAKEN",
        )
        self.write(
            "error:stock",
            "loan",
            "POST",
            "/loans",
            self.lend_payload(n(9), [a(0)]),
            status=409,
            code="ARTICLE_NOT_AVAILABLE",
        )
        before = self.get("/articles/" + a(38))["available_units"]
        before_loans = self.get(
            "/loans?" + urlencode({"neighbor_id": n(9), "page": 1, "size": 50})
        )["total"]
        self.write(
            "error:atomic",
            "loan",
            "POST",
            "/loans",
            self.lend_payload(n(9), [a(38), a(0)]),
            status=409,
            code="ARTICLE_NOT_AVAILABLE",
        )
        self.require(
            self.get("/articles/" + a(38))["available_units"] == before, "sin descuento parcial"
        )
        self.require(
            self.get("/loans?" + urlencode({"neighbor_id": n(9), "page": 1, "size": 50}))["total"]
            == before_loans,
            "sin préstamo parcial",
        )
        self.write(
            "error:limit",
            "loan",
            "POST",
            "/loans",
            self.lend_payload(n(0), [a(39)]),
            status=422,
            code="NEIGHBOR_LIMIT_EXCEEDED",
        )
        self.write(
            "error:duplicate",
            "loan",
            "POST",
            "/loans",
            self.lend_payload(n(8), [a(37), a(37)]),
            status=422,
            code="DUPLICATE_ARTICLE_IN_LOAN",
        )
        self.write(
            "error:deactivate",
            "none",
            "DELETE",
            "/articles/" + a(0),
            status=409,
            code="ARTICLE_HAS_OPEN_LOANS",
        )
        anonymous = self.client.request("GET", "/categories", authenticated=False)
        self.require(anonymous.status == 401, "rechazo sin JWT")
        original = loans[3]["items"][0]
        updated = {
            key: value
            for key, value in self.article_payload(3, ids[4]).items()
            if key != "reference"
        }
        updated["name"] += " actualizado"
        self.write("history:update", "none", "PUT", "/articles/" + a(3), updated, status=200)
        historical = self.get("/loans/" + loans[3]["id"])["items"][0]
        self.require(
            all(
                historical[key] == original[key]
                for key in ("article_name", "article_reference", "category_name")
            ),
            "snapshots históricos",
        )
        before = self.get("/articles/" + a(3))["available_units"]
        path = f"/loans/{loans[3]['id']}/items/{original['id']}/return"
        self.write("return:3", "return", "POST", path, status=200)
        self.require(
            self.get("/articles/" + a(3))["available_units"] == before + 1,
            "devolución repone una unidad",
        )
        self.write("error:return", "return", "POST", path, status=409, code="ITEM_ALREADY_RETURNED")
        self.require(
            self.get("/articles/" + a(3))["available_units"] == before + 1,
            "devolución no duplica inventario",
        )
        # Dejar exactamente tres líneas pendientes: las dos de loan:0 y la de loan:1.
        for index in range(2, 15):
            if index == 3:
                continue
            for item in loans[index]["items"]:
                self.write(
                    f"return:{index}",
                    "return",
                    "POST",
                    f"/loans/{loans[index]['id']}/items/{item['id']}/return",
                    status=200,
                )
        self.journal.append({"type": "phase", "name": "seeded"})
        result = self.verify()
        self.require(
            result["pending_lines"] == 3, "tres líneas reservadas para vencimiento natural"
        )
        return result

    def owned(self):
        articles = {}
        for event in self.journal.outcomes("article"):
            index = (
                int(event["key"].split(":")[-1]) if event["key"].startswith("article:") else None
            )
            if index is None or not 0 <= index < self.journal.header["articles"]:
                raise ToolError("Recibo con creación inesperada; requiere reconciliación manual.")
            ident = identifier(event["resource"]["id"])
            articles[ident] = f"{self.journal.prefix}-{index:04}"
        neighbors = {}
        for event in self.journal.outcomes("neighbor"):
            index = (
                int(event["key"].split(":")[-1]) if event["key"].startswith("neighbor:") else None
            )
            if index is None or not 0 <= index < 10:
                raise ToolError("Recibo con creación inesperada; requiere reconciliación manual.")
            neighbors[identifier(event["resource"]["id"])] = f"{self.journal.prefix}-N{index:02}"
        for ident, document in neighbors.items():
            self.require(
                self.get("/neighbors/" + ident)["document_number"] == document,
                "propiedad del vecino",
            )
        active = []
        for ident, reference in articles.items():
            result = self.client.request("GET", "/articles/" + ident)
            if result.status == 404:
                continue
            self.require(
                result.status == 200 and result.body["reference"] == reference,
                "propiedad del artículo",
            )
            active.append(result.body)
        loans = []
        for event in self.journal.outcomes("loan"):
            loan = self.get("/loans/" + identifier(event["resource"]["id"]))
            self.require(loan["neighbor_id"] in neighbors, "propiedad del préstamo")
            expected = {(item["id"], item["article_id"]) for item in event["resource"]["items"]}
            self.require(
                {(item["id"], item["article_id"]) for item in loan["items"]} == expected
                and all(item["article_id"] in articles for item in loan["items"]),
                "pertenencia de líneas",
            )
            loans.append(loan)
        return articles, neighbors, active, loans

    def verify(self):
        self.require(not self.journal.pending, "recibo sin resultados inciertos")
        articles, neighbors, active, loans = self.owned()
        pending = [item for loan in loans for item in loan["items"] if item["returned_at"] is None]
        expected = {key: 0 for key in articles}
        for item in pending:
            expected[item["article_id"]] += 1
        self.require(
            all(
                row["available_units"] == row["total_units"] - expected[row["id"]] for row in active
            ),
            "inventario y pendientes propios consistentes",
        )
        from_day = min((loan["loaned_at"][:10] for loan in loans), default=None)
        to_day = max((loan["loaned_at"][:10] for loan in loans), default=None)
        report_lines = 0
        if loans:
            rows = self.get(
                "/reports/most-borrowed?" + urlencode({"from": from_day, "to": to_day})
            )["rows"]
            report_lines = sum(
                row["times_borrowed"] for row in rows if row["article_id"] in articles
            )
            self.require(
                report_lines == sum(len(loan["items"]) for loan in loans),
                "reporte histórico inclusivo",
            )
        ready = max((utc(item["due_at"]) for item in pending), default=None)
        complete = (
            len(articles) == self.journal.header["articles"]
            and len(neighbors) == 10
            and len(loans) == 15
            and any(
                event.get("type") == "phase" and event.get("name") == "seeded"
                for event in self.journal.events
            )
        )
        return {
            "complete_demo": complete,
            "cleaned": any(
                event.get("type") == "phase" and event.get("name") == "cleaned"
                for event in self.journal.events
            ),
            "articles_created": len(articles),
            "active_articles": len(active),
            "neighbors_created": len(neighbors),
            "loans_created": len(loans),
            "pending_lines": len(pending),
            "report_lines": report_lines,
            "overdue_ready_after_utc": iso(ready + timedelta(seconds=1)) if ready else None,
            "checks": self.checks,
        }

    def overdue(self, prove=False):
        _, neighbors, active, loans = self.owned()
        response = self.client.request("GET", "/loans/overdue")
        self.require(response.status == 200, "consulta de vencidos")
        now = response.server_time()
        own_ids = {
            item["id"] for loan in loans for item in loan["items"] if item["returned_at"] is None
        }
        expired = [row for row in response.body["items"] if row["item_id"] in own_ids]
        # Date tiene precisión de segundos; el endpoint decide el vencimiento estricto.
        self.require(
            all(utc(row["due_at"]) <= now for row in expired),
            "vencimientos coherentes con fecha del servidor",
        )
        summary = {
            "server_utc": iso(now),
            "own_overdue_lines": len(expired),
            "minimum_met": len(expired) >= 3,
            "proof_executed": False,
        }
        if prove and len(expired) >= 3:
            neighbor = next(
                loan["neighbor_id"]
                for loan in loans
                if any(item["id"] == expired[0]["item_id"] for item in loan["items"])
            )
            available = next((row for row in active if row["available_units"] > 0), None)
            self.require(
                available is not None and neighbor in neighbors,
                "artículo propio disponible para comprobar bloqueo",
            )
            self.write(
                "error:overdue",
                "loan",
                "POST",
                "/loans",
                self.lend_payload(neighbor, [available["id"]]),
                status=409,
                code="NEIGHBOR_HAS_OVERDUE",
            )
            summary["proof_executed"] = True
        return summary

    def cleanup(self, apply=False):
        self.require(not self.journal.pending, "sin escrituras inciertas antes de limpiar")
        _, _, active, loans = (
            self.owned()
        )  # Verificar TODA la propiedad antes de la primera escritura.
        pending = [
            (loan["id"], item["id"])
            for loan in loans
            for item in loan["items"]
            if item["returned_at"] is None
        ]
        result = {
            "apply": apply,
            "lines_to_return": len(pending),
            "articles_to_deactivate": len(active),
            "history_preserved": True,
            "neighbors_preserved": True,
        }
        if apply:
            self.config.allow_writes()
            for loan_id, item_id in pending:
                self.write(
                    "cleanup:return:" + item_id,
                    "return",
                    "POST",
                    f"/loans/{identifier(loan_id)}/items/{identifier(item_id)}/return",
                    status=200,
                )
            for row in active:
                self.write(
                    "cleanup:article:" + row["id"],
                    "none",
                    "DELETE",
                    "/articles/" + identifier(row["id"]),
                    status=204,
                )
            self.journal.append({"type": "phase", "name": "cleaned"})
        return result

    def benchmark(self, samples=10):
        self.require(self.journal.header["articles"] >= 5000, "perfil de al menos 5000 artículos")
        path = "/articles?" + urlencode({"q": self.journal.prefix, "page": 1, "size": 20})
        warm = self.get(path)
        self.require(warm["total"] >= 5000, "5000 artículos activos en el catálogo medido")
        measured = []
        for _ in range(samples):
            start = time.perf_counter()
            result = self.get(path)
            measured.append((time.perf_counter() - start) * 1000)
            self.require(result["total"] >= 5000, "catálogo de medición sin cambios")
        values = sorted(measured)
        return {
            "samples": samples,
            "matching_articles": warm["total"],
            "median_ms": round(statistics.median(values), 3),
            "p95_ms": round(values[math.ceil(samples * 0.95) - 1], 3),
            "max_ms": round(max(values), 3),
            "all_under_300ms": max(values) < 300,
        }
