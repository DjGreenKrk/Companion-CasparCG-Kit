#!/usr/bin/env python3
"""Dump the buttons and actions of a Bitfocus Companion .companionconfig export.

Usage:
    python dump_companion_config.py export.companionconfig [--page N] [--grep TEXT]

Prints one block per button (page/row/column, label, then each step's actions with
their options). Output is UTF-8 regardless of the console code page, so Polish
characters etc. survive on Windows.
"""
import argparse
import io
import json
import sys


def button_label(ctl):
    style = ctl.get("style", {})
    if "text" in style:
        return style["text"]
    for layer in style.get("layers", []):
        if layer.get("type") == "text":
            text = layer.get("text")
            if isinstance(text, dict):
                return text.get("value", "")
            return text or ""
    return ""


def iter_actions(ctl):
    for step_id, step in (ctl.get("steps") or {}).items():
        for set_id, actions in (step.get("action_sets") or {}).items():
            if isinstance(actions, list):
                for action in actions:
                    yield step_id, set_id, action


def option_value(opt):
    if isinstance(opt, dict) and "value" in opt:
        return opt["value"]
    return opt


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("config")
    ap.add_argument("--page", help="only this page number")
    ap.add_argument("--grep", help="only buttons whose dump contains this text (case-insensitive)")
    args = ap.parse_args()

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    with io.open(args.config, encoding="utf-8") as f:
        data = json.load(f)

    print(f"# companion build: {data.get('companionBuild')}  config version: {data.get('version')}")
    for page_no, page in data.get("pages", {}).items():
        if args.page and args.page != page_no:
            continue
        print(f"\n# PAGE {page_no}: {page.get('name')!r}")
        for row, cols in page.get("controls", {}).items():
            for col, ctl in cols.items():
                lines = [f"== {page_no}/{row}/{col} [{ctl.get('type')}] {button_label(ctl)!r}"]
                for step_id, set_id, action in iter_actions(ctl):
                    opts = {k: option_value(v) for k, v in (action.get("options") or {}).items()}
                    lines.append(f"   step{step_id}/{set_id}: {action.get('definitionId')} "
                                 f"{json.dumps(opts, ensure_ascii=False)}")
                block = "\n".join(lines)
                if args.grep and args.grep.lower() not in block.lower():
                    continue
                print(block)

    custom = data.get("custom_variables") or {}
    if custom and not args.page:
        print("\n# CUSTOM VARIABLES")
        for name, var in custom.items():
            print(f"   {name}: {json.dumps(var, ensure_ascii=False)[:200]}")


if __name__ == "__main__":
    main()
