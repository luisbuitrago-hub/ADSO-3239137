from contextlib import redirect_stdout, redirect_stderr
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import io
import json
from pathlib import Path
import secrets
import threading
import unittest
from unittest.mock import patch

from kitchenware_tool.config import Config, ToolError
from kitchenware_tool.http import Client, Response
from kitchenware_tool.cli import main


class HTTPTests(unittest.TestCase):
    def setUp(self):
        self.secret = secrets.token_urlsafe(24)
        self.token = secrets.token_urlsafe(40)
        self.requests = []
        test = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def do_GET(self):
                test.requests.append((self.path, self.headers.get("Authorization")))
                if self.path.endswith("/redirect"):
                    self.send_response(302)
                    self.send_header("Location", test.base + "/capture")
                    self.end_headers()
                else:
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.end_headers()
                    self.wfile.write(b'{"status":"ok"}')

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                test.assertEqual(body["password"], test.secret)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(
                    json.dumps(
                        {
                            "access_token": test.token,
                            "token_type": "Bearer",
                            "expires_in": 28800,
                            "role": "admin",
                        }
                    ).encode()
                )

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(self.server.shutdown)
        self.base = f"http://127.0.0.1:{self.server.server_port}/api/v1"
        self.config = Config(self.base, Path("not-created"), secrets.token_hex(5), self.secret)
        self.client = Client(self.config)

    def test_login_and_bearer_only_in_headers_and_server_date(self):
        self.client.login()
        result = self.client.request("GET", "/health")
        self.assertEqual(result.status, 200)
        self.assertIsNotNone(result.server_time())
        self.assertEqual([path for path, _ in self.requests], ["/api/v1/health"])
        self.assertTrue(
            self.requests[0][1] == "Bearer " + self.token, "Debe enviar Bearer por cabecera."
        )
        self.assertNotIn(self.token, repr(result))

    def test_no_credentials_forwarded_on_redirect(self):
        self.client.login()
        with self.assertRaises(ToolError):
            self.client.request("GET", "/redirect")
        self.assertEqual([path for path, _ in self.requests], ["/api/v1/redirect"])

    def test_environment_proxy_not_used(self):
        with patch.dict(
            "os.environ", {"HTTP_PROXY": "http://127.0.0.1:1", "http_proxy": "http://127.0.0.1:1"}
        ):
            self.assertEqual(Client(self.config).request("GET", "/health").status, 200)

    def test_network_error_does_not_echo_sensitive_exception(self):
        with patch.object(self.client._opener, "open", side_effect=ValueError(self.secret)):
            with self.assertRaises(ToolError) as caught:
                self.client.request("POST", "/loans", {})
        self.assertNotIn(self.secret, str(caught.exception))

    def test_cli_guard_runs_before_http_and_hides_credentials(self):
        env = {
            "KITCHENWARE_API_URL": self.base,
            "KITCHENWARE_STATE": "not-created",
            "KITCHENWARE_ADMIN_USERNAME": self.config.username,
            "KITCHENWARE_ADMIN_PASSWORD": self.secret,
        }
        out, err = io.StringIO(), io.StringIO()
        with patch.dict("os.environ", env, clear=True), redirect_stdout(out), redirect_stderr(err):
            self.assertEqual(main(["seed"]), 1)
        self.assertNotIn(self.secret, out.getvalue() + err.getvalue())
        self.assertEqual(self.requests, [])

    def test_error_body_is_not_logged_or_represented(self):
        result = Response(
            500, {"code": self.secret, "message": self.token, "details": [self.secret]}
        )
        self.assertEqual(result.code, "HTTP_ERROR")
        self.assertNotIn(self.secret, repr(result))
        self.assertNotIn(self.token, repr(result))

    def test_invalid_cli_arguments_do_not_echo_accidental_secret(self):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            self.assertEqual(main(["plan", self.secret]), 1)
        self.assertNotIn(self.secret, out.getvalue() + err.getvalue())
        self.assertEqual(self.requests, [])
