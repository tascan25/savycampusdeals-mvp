import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"


def load_json(filename):
    path = DATA_DIR / filename

    if not path.exists():
        raise FileNotFoundError(f"{filename} not found.")

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def success(message):
    print(f"✅ {message}")


def warning(message):
    print(f"⚠️  {message}")


def error(message):
    print(f"❌ {message}")


def info(message):
    print(f"ℹ️  {message}")


def divider():
    print("\n" + "─" * 50)


def normalize(text):
    if text is None:
        return ""
    return str(text).strip().lower()