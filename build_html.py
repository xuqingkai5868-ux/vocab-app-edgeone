"""Refresh embedded schedule data in index.html.

This script intentionally preserves the current app shell, auth flow, and API
logic. It only replaces the inline SCHEDULE constant and TOTAL_WORDS value from
schedule.min.json.
"""

from pathlib import Path
import json
import re


ROOT = Path(__file__).resolve().parent
INDEX_PATH = ROOT / "index.html"
SCHEDULE_PATH = ROOT / "schedule.min.json"


def main():
    schedule = json.loads(SCHEDULE_PATH.read_text(encoding="utf-8"))
    schedule_json = json.dumps(schedule, ensure_ascii=False, separators=(",", ":"))
    total_words = sum(len(day.get("words", [])) for day in schedule if day.get("type") == "新词")

    html = INDEX_PATH.read_text(encoding="utf-8")
    html, schedule_replacements = re.subn(
        r"const SCHEDULE = .*?;\s*\n\s*// ===== Auth & API State =====",
        f"const SCHEDULE = {schedule_json};\n\n// ===== Auth & API State =====",
        html,
        count=1,
        flags=re.S,
    )
    if schedule_replacements != 1:
        raise SystemExit("Could not find exactly one inline SCHEDULE block in index.html")

    html, total_replacements = re.subn(
        r"const TOTAL_WORDS = \d+;",
        f"const TOTAL_WORDS = {total_words};",
        html,
        count=1,
    )
    if total_replacements != 1:
        raise SystemExit("Could not find exactly one TOTAL_WORDS constant in index.html")

    INDEX_PATH.write_text(html, encoding="utf-8", newline="")
    print(f"Updated index.html with {len(schedule)} days and {total_words} new-word entries.")


if __name__ == "__main__":
    main()
