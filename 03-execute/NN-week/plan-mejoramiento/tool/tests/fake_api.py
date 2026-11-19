"""Doble en memoria del contrato HTTP; no es evidencia PostgreSQL ni cambia el reloj."""

from collections import Counter
from datetime import datetime, timedelta, timezone
from email.utils import format_datetime
from urllib.parse import urlsplit, parse_qs
import uuid

from kitchenware_tool.http import Response
from kitchenware_tool.workflow import iso


class FakeAPI:
    def __init__(self):
        self.now = datetime(2026, 11, 1, 12, tzinfo=timezone.utc)
        self.categories = [
            {"id": str(uuid.uuid4()), "name": name}
            for name in ["cubiertos", "hornillas", "manteles", "ollas", "vajilla"]
        ]
        self.articles = {}
        self.neighbors = {}
        self.loans = {}
        self.calls = []
        self.logged_in = False

    def login(self):
        self.logged_in = True

    def status(self, loan):
        pending = [item for item in loan["items"] if item["returned_at"] is None]
        if not pending:
            return "closed"
        return "overdue" if any(item["due_at"] < iso(self.now) for item in pending) else "open"

    def response(self, status, body):
        return Response(status, body, format_datetime(self.now, usegmt=True))

    def error(self, status, code):
        return self.response(status, {"code": code, "message": "Error sintético.", "details": []})

    def request(self, method, path, payload=None, authenticated=True):
        self.calls.append((method, path, payload))
        if not authenticated or not self.logged_in:
            return self.error(401, "INVALID_CREDENTIALS")
        url = urlsplit(path)
        parts = url.path.strip("/").split("/")
        query = parse_qs(url.query)
        if path == "/categories":
            return self.response(200, self.categories)
        if path == "/health":
            return self.response(200, {"status": "ok"})
        if parts == ["articles"] and method == "POST":
            if any(
                row["reference"] == payload["reference"] and not row["deleted"]
                for row in self.articles.values()
            ):
                return self.error(409, "REFERENCE_TAKEN")
            row = {
                "id": str(uuid.uuid4()),
                **payload,
                "available_units": payload["total_units"],
                "category": next(
                    cat for cat in self.categories if cat["id"] == payload["category_id"]
                ),
                "cover_key": None,
                "deleted": False,
            }
            self.articles[row["id"]] = row
            return self.response(201, dict(row))
        if parts == ["articles"] and method == "GET":
            rows = [
                dict(row)
                for row in self.articles.values()
                if not row["deleted"] and query.get("q", [""])[0] in row["name"]
            ]
            return self.response(
                200, {"items": rows[:20], "page": 1, "size": 20, "total": len(rows)}
            )
        if parts[0] == "articles" and len(parts) == 2:
            row = self.articles.get(parts[1])
            if row is None or row["deleted"]:
                return self.error(404, "NOT_FOUND")
            if method == "GET":
                return self.response(200, dict(row))
            if method == "DELETE":
                if row["available_units"] != row["total_units"]:
                    return self.error(409, "ARTICLE_HAS_OPEN_LOANS")
                row["deleted"] = True
                return self.response(204, None)
            if method == "PUT":
                row.update(payload)
                row["category"] = next(
                    cat for cat in self.categories if cat["id"] == row["category_id"]
                )
                return self.response(200, dict(row))
        if parts == ["neighbors"] and method == "POST":
            if any(
                row["document_number"] == payload["document_number"]
                for row in self.neighbors.values()
            ):
                return self.error(409, "DOCUMENT_TAKEN")
            row = {"id": str(uuid.uuid4()), **payload}
            self.neighbors[row["id"]] = row
            return self.response(201, dict(row))
        if parts[0] == "neighbors" and len(parts) == 2:
            row = self.neighbors.get(parts[1])
            if row is None:
                return self.error(404, "NOT_FOUND")
            pending = sum(
                item["returned_at"] is None
                for loan in self.loans.values()
                if loan["neighbor_id"] == row["id"]
                for item in loan["items"]
            )
            return self.response(200, {**row, "active_loans": pending})
        if parts == ["loans"] and method == "POST":
            if set(payload) != {"neighbor_id", "items"}:
                return self.error(422, "VALIDATION_ERROR")
            ids = [item["article_id"] for item in payload["items"]]
            if len(set(ids)) != len(ids):
                return self.error(422, "DUPLICATE_ARTICLE_IN_LOAN")
            pending = [
                item
                for loan in self.loans.values()
                if loan["neighbor_id"] == payload["neighbor_id"]
                for item in loan["items"]
                if item["returned_at"] is None
            ]
            if any(item["due_at"] < iso(self.now) for item in pending):
                return self.error(409, "NEIGHBOR_HAS_OVERDUE")
            if len(pending) + len(ids) > 3:
                return self.error(422, "NEIGHBOR_LIMIT_EXCEEDED")
            if any(self.articles[ident]["available_units"] < 1 for ident in ids):
                return self.error(409, "ARTICLE_NOT_AVAILABLE")
            items = []
            for ident in ids:
                row = self.articles[ident]
                row["available_units"] -= 1
                items.append(
                    {
                        "id": str(uuid.uuid4()),
                        "article_id": ident,
                        "article_name": row["name"],
                        "article_reference": row["reference"],
                        "category_name": row["category"]["name"],
                        "due_at": iso(self.now + timedelta(days=3)),
                        "returned_at": None,
                    }
                )
            loan = {
                "id": str(uuid.uuid4()),
                "neighbor_id": payload["neighbor_id"],
                "loaned_at": iso(self.now),
                "items": items,
            }
            self.loans[loan["id"]] = loan
            return self.response(201, {**loan, "status": self.status(loan)})
        if parts == ["loans"] and method == "GET":
            rows = [
                {**loan, "status": self.status(loan)}
                for loan in self.loans.values()
                if not query.get("neighbor_id") or loan["neighbor_id"] == query["neighbor_id"][0]
            ]
            return self.response(200, {"items": rows, "total": len(rows), "page": 1, "size": 50})
        if parts == ["loans", "overdue"]:
            rows = [
                {
                    "loan_id": loan["id"],
                    "item_id": item["id"],
                    "article_name": item["article_name"],
                    "neighbor_name": self.neighbors[loan["neighbor_id"]]["full_name"],
                    "due_at": item["due_at"],
                    "days_late": (
                        self.now - datetime.fromisoformat(item["due_at"].replace("Z", "+00:00"))
                    ).days,
                }
                for loan in self.loans.values()
                for item in loan["items"]
                if item["returned_at"] is None and item["due_at"] < iso(self.now)
            ]
            return self.response(200, {"items": rows})
        if parts[0] == "loans" and len(parts) == 2 and parts[1] in self.loans:
            loan = self.loans[parts[1]]
            return self.response(200, {**loan, "status": self.status(loan)})
        if parts[0] == "loans" and len(parts) == 5 and parts[-1] == "return":
            loan = self.loans[parts[1]]
            item = next(item for item in loan["items"] if item["id"] == parts[3])
            if item["returned_at"]:
                return self.error(409, "ITEM_ALREADY_RETURNED")
            item["returned_at"] = iso(self.now)
            self.articles[item["article_id"]]["available_units"] += 1
            return self.response(200, dict(item))
        if parts == ["reports", "most-borrowed"]:
            counter = Counter(
                (item["article_id"], item["article_name"], item["category_name"])
                for loan in self.loans.values()
                for item in loan["items"]
            )
            rows = [
                {
                    "article_id": key[0],
                    "article_name": key[1],
                    "category_name": key[2],
                    "times_borrowed": value,
                }
                for key, value in counter.items()
            ]
            return self.response(
                200, {"from": query["from"][0], "to": query["to"][0], "rows": rows}
            )
        return self.error(404, "NOT_FOUND")
