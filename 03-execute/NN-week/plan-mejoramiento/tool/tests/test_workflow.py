import contextlib
from datetime import timedelta
import io
from pathlib import Path
import secrets
import tempfile
import unittest

from kitchenware_tool.config import Config, ToolError
from kitchenware_tool.state import Journal
from kitchenware_tool.workflow import Workflow
from tests.fake_api import FakeAPI


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="kitchenware-tool-unit-")
        self.addCleanup(self.directory.cleanup)
        self.config = Config(
            "http://127.0.0.1:12345/api/v1",
            Path(self.directory.name) / "receipt.jsonl",
            secrets.token_hex(4),
            secrets.token_urlsafe(24),
            "http://127.0.0.1:12345/api/v1",
            "isolated-demo",
        )
        self.api = FakeAPI()
        self.api.login()
        self.journal = Journal(self.config, create=True)
        self.addCleanup(self.journal.close)
        self.flow = Workflow(self.config, self.api, self.journal)

    def test_seed_counts_inventory_history_and_actual_contract_payloads(self):
        result = self.flow.seed()
        self.assertEqual(
            (result["articles_created"], result["neighbors_created"], result["loans_created"]),
            (40, 10, 15),
        )
        self.assertTrue(result["complete_demo"])
        self.assertEqual(result["pending_lines"], 3)
        self.assertEqual(result["report_lines"], 16)
        self.assertEqual(
            sum(self.api.status(loan) == "closed" for loan in self.api.loans.values()), 13
        )
        for method, path, body in self.api.calls:
            if method == "POST" and path == "/loans":
                self.assertEqual(set(body), {"neighbor_id", "items"})
                self.assertTrue(all(set(item) == {"article_id"} for item in body["items"]))
        content = self.config.state.read_text()
        self.assertNotIn(self.config.password, content)
        self.assertNotIn("access_token", content)
        self.assertNotIn("password", content)

    def test_overdue_requires_natural_time_and_tests_block_with_simulated_server_date(self):
        self.flow.seed()
        first = self.flow.overdue(prove=True)
        self.assertFalse(first["minimum_met"])
        self.assertFalse(first["proof_executed"])
        # Solo el doble cambia su fecha. No se altera reloj ni datos de PostgreSQL.
        self.api.now += timedelta(days=3, seconds=1)
        result = self.flow.overdue(prove=True)
        self.assertEqual(result["own_overdue_lines"], 3)
        self.assertTrue(result["proof_executed"])
        self.assertEqual(len(self.api.loans), 15)

    def test_exact_deadline_is_not_overdue(self):
        self.flow.seed()
        self.api.now += timedelta(days=3)
        self.assertEqual(self.flow.overdue()["own_overdue_lines"], 0)

    def test_cleanup_is_readonly_by_default_and_apply_preserves_history_and_neighbors(self):
        self.flow.seed()
        before = len(self.api.calls)
        plan = self.flow.cleanup()
        self.assertEqual(plan["lines_to_return"], 3)
        self.assertTrue(all(method == "GET" for method, _, _ in self.api.calls[before:]))
        self.flow.cleanup(apply=True)
        self.assertTrue(all(row["deleted"] for row in self.api.articles.values()))
        self.assertEqual(len(self.api.neighbors), 10)
        self.assertEqual(len(self.api.loans), 15)
        self.assertEqual(self.flow.cleanup(apply=True)["articles_to_deactivate"], 0)
        self.assertEqual(self.flow.verify()["pending_lines"], 0)

    def test_cleanup_refuses_foreign_identity_before_any_write(self):
        self.flow.seed()
        ident = next(iter(self.api.neighbors))
        self.api.neighbors[ident]["document_number"] = "registro-ajeno"
        before = len(self.api.calls)
        with self.assertRaises(ToolError):
            self.flow.cleanup(apply=True)
        self.assertTrue(all(method == "GET" for method, _, _ in self.api.calls[before:]))

    def test_ambiguous_mutation_does_not_retry_and_blocks_subsequent_mutation(self):
        def disconnected(*args, **kwargs):
            raise ToolError("Fallo de red sintético.")

        self.api.request = disconnected
        with self.assertRaises(ToolError):
            self.flow.write("article:0", "article", "POST", "/articles", {})
        self.assertEqual(self.journal.pending, {"article:0"})
        with self.assertRaises(ToolError):
            self.flow.write("article:1", "article", "POST", "/articles", {})
        self.assertEqual(len([e for e in self.journal.events if e["type"] == "intent"]), 1)

    def test_partial_receipt_not_reported_as_complete(self):
        self.assertFalse(self.flow.verify()["complete_demo"])

    def test_benchmark_requires_5000_active_articles(self):
        self.flow.seed()
        with self.assertRaises(ToolError):
            self.flow.benchmark()

    def test_missing_server_date_is_not_replaced_by_local_clock(self):
        self.flow.seed()
        original = self.api.request

        def without_date(*args, **kwargs):
            value = original(*args, **kwargs)
            value.date = None
            return value

        self.api.request = without_date
        with self.assertRaises(ToolError):
            self.flow.overdue()
