from dataclasses import replace
import json
import os
from pathlib import Path
import secrets
import tempfile
import unittest

from kitchenware_tool.config import Config, ToolError, base_url
from kitchenware_tool.state import Journal, identifier


class ConfigTests(unittest.TestCase):
    def test_destination_required_and_no_default_development_target(self):
        with self.assertRaises(ToolError):
            Config.read({})

    def test_rejects_credentials_queries_fragments_and_remote_cleartext(self):
        for target in [
            "http://user:example@localhost/api/v1",
            "http://localhost/api/v1?x=1",
            "http://localhost/api/v1#x",
            "http://example.invalid/api/v1",
            "file:///api/v1",
            "http://localhost/elsewhere",
            "http://localhost:0/api/v1",
        ]:
            with self.subTest(target=target), self.assertRaises(ToolError):
                base_url(target)

    def test_permits_tls_and_loopback(self):
        self.assertEqual(
            base_url("https://example.invalid/api/v1/"), "https://example.invalid/api/v1"
        )
        self.assertEqual(base_url("http://127.0.0.1:12345/api/v1"), "http://127.0.0.1:12345/api/v1")

    def test_write_guard_needs_both_explicit_values(self):
        config = Config("http://127.0.0.1:12345/api/v1", Path("not-created"), "", "")
        for changes in [{}, {"confirmation": config.url}, {"acknowledgement": "isolated-demo"}]:
            with self.assertRaises(ToolError):
                replace(config, **changes).allow_writes()
        replace(config, confirmation=config.url, acknowledgement="isolated-demo").allow_writes()

    def test_limits_and_hidden_credentials(self):
        secret = secrets.token_urlsafe(24)
        env = {
            "KITCHENWARE_API_URL": "http://localhost/api/v1",
            "KITCHENWARE_STATE": "not-created",
            "KITCHENWARE_ADMIN_PASSWORD": secret,
        }
        self.assertNotIn(secret, repr(Config.read(env)))
        for count in ["39", "5001", "invalid"]:
            with self.assertRaises(ToolError):
                Config.read({**env, "KITCHENWARE_ARTICLE_COUNT": count})


class JournalTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="kitchenware-tool-journal-")
        self.addCleanup(self.directory.cleanup)
        self.config = Config(
            "http://localhost/api/v1", Path(self.directory.name) / "state.jsonl", "", ""
        )

    def test_exclusive_create_private_mode_and_lock(self):
        with Journal(self.config, create=True):
            self.assertEqual(os.stat(self.config.state).st_mode & 0o777, 0o600)
            for create in [True, False]:
                with self.assertRaises(ToolError):
                    Journal(self.config, create=create)
        with Journal(self.config) as state:
            self.assertEqual(len(state.events), 1)

    def test_rejects_wrong_target_without_modifying_receipt(self):
        with Journal(self.config, create=True):
            pass
        content = self.config.state.read_bytes()
        with self.assertRaises(ToolError):
            Journal(replace(self.config, url="http://localhost:6000/api/v1"))
        self.assertEqual(self.config.state.read_bytes(), content)

    def test_refuses_symlinks_and_public_permissions(self):
        with Journal(self.config, create=True):
            pass
        alias = self.config.state.with_name("link.jsonl")
        alias.symlink_to(self.config.state)
        with self.assertRaises(ToolError):
            Journal(replace(self.config, state=alias))
        os.chmod(self.config.state, 0o644)
        with self.assertRaises(ToolError):
            Journal(self.config)

    def test_refuses_torn_log_without_automatic_truncation(self):
        with Journal(self.config, create=True):
            pass
        with self.config.state.open("a") as file:
            file.write("{")
        before = self.config.state.read_bytes()
        with self.assertRaises(ToolError):
            Journal(self.config)
        self.assertEqual(self.config.state.read_bytes(), before)

    def test_uuid_paths_cannot_escape_resource(self):
        for value in ["../neighbors", "not-a-uuid", None]:
            with self.assertRaises(ToolError):
                identifier(value)

    def test_new_intent_with_previous_completed_key_remains_ambiguous(self):
        with Journal(self.config, create=True) as state:
            state.append({"type": "intent", "key": "repeat"})
            state.append({"type": "outcome", "key": "repeat"})
            self.assertEqual(state.pending, set())
            state.append({"type": "intent", "key": "repeat"})
            self.assertEqual(state.pending, {"repeat"})
