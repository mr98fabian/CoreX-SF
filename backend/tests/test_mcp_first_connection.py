"""Guard: the MCP server's INSTRUCTIONS carry the first-connection checklist, so the
assistant offers Plaid (via its own platform) and loads every account even if the user
never pasted the kit. Mirrors frontend/src/lib/aiKit.ts FIRST_ACTIONS (vitest checks the
word-for-word sync)."""
import re
from pathlib import Path

SRC = (Path(__file__).resolve().parents[2] / "mcp" / "korex_mcp.py").read_text(encoding="utf-8")
INSTRUCTIONS = re.search(r'INSTRUCTIONS = """(.*?)"""', SRC, re.S).group(1)


def test_first_connection_section_exists_and_is_triggered_by_zero_accounts():
    assert "PRIMERA CONEXIÓN" in INSTRUCTIONS
    assert "si `list_accounts` devuelve cero cuentas" in INSTRUCTIONS


def test_plaid_only_through_the_assistants_own_platform_never_credentials_in_chat():
    plaid = [l for l in INSTRUCTIONS.splitlines() if "plaid" in l.lower()]
    assert plaid, "the checklist must mention Plaid"
    for line in plaid:
        assert "su propia plataforma" in line and "nunca dentro de KoreX" in line
    assert "nunca pidiendo usuario, contraseña ni códigos del banco en el chat" in INSTRUCTIONS


def test_loads_all_accounts_reports_and_never_leaves_the_user_at_zero():
    assert "TODAS las cuentas" in INSTRUCTIONS
    assert "qué quedó cargado, qué no y por qué" in INSTRUCTIONS
    assert "cargar a mano cada cuenta" in INSTRUCTIONS
    assert "Nunca lo dejes con KoreX en cero" in INSTRUCTIONS


def test_no_personal_names():
    assert not re.search(r"mijo|fabi[aá]n", INSTRUCTIONS, re.I)
