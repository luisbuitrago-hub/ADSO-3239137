import argparse
import json
import sys

from .config import Config, ToolError
from .http import Client
from .state import Journal
from .workflow import Workflow


class SafeParser(argparse.ArgumentParser):
    def error(self, message):
        # No repetir argumentos: podrían contener un secreto pegado por accidente.
        raise ToolError("Argumentos inválidos. Consultar --help; credenciales solo por entorno.")


def main(argv=None):
    parser = SafeParser(description="Demostración HTTP segura de Kitchenware; sin SQL directo.")
    parser.add_argument(
        "command", choices=["plan", "seed", "verify", "overdue", "cleanup", "benchmark"]
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Aplicar únicamente cleanup o demostrar bloqueo overdue.",
    )
    try:
        args = parser.parse_args(argv)
        if args.apply and args.command not in ("cleanup", "overdue"):
            raise ToolError("--apply solo corresponde a cleanup u overdue.")
        config = Config.read()
        writes = args.command == "seed" or args.apply
        if writes:
            config.allow_writes()
        if args.command == "plan":
            result = {
                "target": config.url,
                "articles": config.articles,
                "neighbors": 10,
                "loans": 15,
                "reserved_pending_lines": 3,
                "writes_executed": False,
            }
        else:
            with Journal(config, create=args.command == "seed") as journal:
                client = Client(config)
                client.login()
                flow = Workflow(
                    config, client, journal, progress=lambda text: print(text, flush=True)
                )
                if args.command == "seed":
                    result = flow.seed()
                elif args.command == "verify":
                    result = flow.verify()
                elif args.command == "overdue":
                    result = flow.overdue(prove=args.apply)
                elif args.command == "cleanup":
                    result = flow.cleanup(apply=args.apply)
                else:
                    result = flow.benchmark()
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        if args.command == "verify" and not result["complete_demo"]:
            return 2
        if args.command == "overdue" and not result["minimum_met"]:
            return 2
        if args.command == "benchmark" and not result["all_under_300ms"]:
            return 2
        return 0
    except ToolError as error:
        print("ERROR: " + str(error), file=sys.stderr)
        return 1
    except KeyboardInterrupt:
        print("Interrumpido. Consultar el recibo antes de cualquier reintento.", file=sys.stderr)
        return 1
    except Exception:
        print(
            "ERROR: fallo de contrato, recibo o entorno; detalles omitidos para proteger credenciales. No reintentar escrituras sin reconciliar.",
            file=sys.stderr,
        )
        return 1
