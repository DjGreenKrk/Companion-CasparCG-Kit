#!/usr/bin/env python3
"""Builds the release assets into dist/ (run after `npm run build`, which makes the module .tgz).

  python3 tools/build_release.py            # checks, then dist/:
    Companion-CasparCG-Kit-<version>.zip          everything: module package, both skills, docs
    casparcg-server-<module version>.tgz      Companion module (Modules -> Import module package)
    <skill>-<skill version>.skill             skill for the Claude apps (upload / "Save skill")
    <skill>-<skill version>.zip               same skill as a plain folder (Claude Code, other agents)
    SHA256SUMS.txt, RELEASE_NOTES.md

  python3 tools/build_release.py --check    # only the consistency checks (CI)

Checks: each skill passes the Agent Skills rules (kebab-case name = folder name, description up to
1024 characters without angle brackets, exactly one SKILL.md) and its version in SKILL.md
(metadata.version) equals .claude-plugin/plugin.json and the marketplace entry.
"""
import argparse
import hashlib
import json
import re
import sys
import zipfile
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
SKILLS = ROOT / "skills"
# files that are not part of an installed skill (the .skill / .zip are the plain Agent Skills folder;
# Claude Code installs the plugin variant from the marketplace instead)
SKIP_PARTS = {"__pycache__", "node_modules", ".claude-plugin", "evals"}
SKIP_NAMES = {".DS_Store"}


def frontmatter(skill_md):
    m = re.match(r"^---\n(.*?)\n---", skill_md.read_text(encoding="utf-8"), re.S)
    if not m:
        raise SystemExit(f"{skill_md}: no YAML frontmatter")
    return yaml.safe_load(m.group(1))


def check_skill(folder, marketplace):
    errors = []
    fm = frontmatter(folder / "SKILL.md")
    name, desc = fm.get("name", ""), str(fm.get("description", "")).strip()
    version = str((fm.get("metadata") or {}).get("version", ""))
    if name != folder.name or not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", name) or len(name) > 64:
        errors.append(f"name '{name}' must be kebab-case and equal the folder name")
    if not desc or len(desc) > 1024 or "<" in desc or ">" in desc:
        errors.append("description must be 1-1024 characters without < >")
    if len([p for p in folder.rglob("SKILL.md") if not SKIP_PARTS & set(p.relative_to(folder).parts)]) != 1:
        errors.append("must contain exactly one SKILL.md")
    if not re.fullmatch(r"\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?", version):
        errors.append(f"metadata.version '{version}' is not a semantic version")
    plugin = json.loads((folder / ".claude-plugin" / "plugin.json").read_text(encoding="utf-8"))
    if plugin.get("name") != name or plugin.get("version") != version:
        errors.append(f"plugin.json has {plugin.get('name')} {plugin.get('version')}, SKILL.md has {name} {version}")
    entry = next((p for p in marketplace["plugins"] if p["name"] == name), None)
    if not entry or entry.get("version") != version or entry.get("source") != f"./skills/{name}":
        errors.append("marketplace.json entry missing or with another version / source")
    if not (folder / "CHANGELOG.md").read_text(encoding="utf-8").count(f"## {version}"):
        errors.append(f"CHANGELOG.md has no section for {version}")
    return name, version, errors


def zip_skill(folder, target):
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(folder.rglob("*")):
            rel = f.relative_to(folder.parent)
            if f.is_file() and not SKIP_PARTS & set(rel.parts) and f.name not in SKIP_NAMES:
                z.write(f, rel)


def changelog_section(path, heading_prefix):
    text = path.read_text(encoding="utf-8")
    parts = re.split(r"(?m)^# ", text)
    section = next((p for p in parts if p.startswith(heading_prefix)), "")
    return "# " + section.strip() if section else ""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()

    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    module_version = package["version"]
    release_version = module_version.removesuffix("-by-GC")
    marketplace = json.loads((ROOT / ".claude-plugin" / "marketplace.json").read_text(encoding="utf-8"))
    manifest = json.loads((ROOT / "companion" / "manifest.json").read_text(encoding="utf-8"))

    skills, failed = [], False
    for folder in sorted(p for p in SKILLS.iterdir() if (p / "SKILL.md").exists()):
        name, version, errors = check_skill(folder, marketplace)
        for e in errors:
            print(f"ERROR {name}: {e}")
        failed |= bool(errors)
        skills.append((folder, name, version))
    if not changelog_section(ROOT / "Changelog.md", f"Companion CasparCG Kit {release_version}"):
        print(f"ERROR Changelog.md has no section 'Companion CasparCG Kit {release_version}'")
        failed = True
    if failed:
        sys.exit(1)
    print(f"checks passed: module {module_version}, " + ", ".join(f"{n} {v}" for _, n, v in skills))
    if a.check:
        return

    tgz = ROOT / f"{manifest['id']}-{module_version}.tgz"
    if not tgz.exists():
        sys.exit(f"{tgz.name} not found - run `npm run build` first")
    DIST.mkdir(exist_ok=True)
    for old in DIST.iterdir():
        old.unlink()

    assets = [DIST / tgz.name]
    assets[0].write_bytes(tgz.read_bytes())
    for folder, name, version in skills:
        for ext in ("skill", "zip"):
            target = DIST / f"{name}-{version}.{ext}"
            zip_skill(folder, target)
            assets.append(target)

    notes = [
        f"# Companion CasparCG Kit {release_version}",
        "",
        "| File | What it is | How to install |",
        "| --- | --- | --- |",
        f"| `Companion-CasparCG-Kit-{release_version}.zip` | everything below in one archive | unpack |",
        f"| `{tgz.name}` | Companion module **{module_version}** | Companion → Modules → Import module package |",
    ]
    for _, name, version in skills:
        notes.append(f"| `{name}-{version}.skill` | skill **{name} {version}** for the Claude apps | upload in Claude → Settings → Skills, or *Save skill* |")
        notes.append(f"| `{name}-{version}.zip` | the same skill as a folder | unpack into `~/.claude/skills/` (Claude Code) or another agent's skills folder |")
    notes += [
        "",
        "Claude Code can also install the skills as plugins from this repository:",
        "`/plugin marketplace add DjGreenKrk/Companion-CasparCG-Kit`, then `/plugin install <skill>@companion-casparcg-kit`.",
        "",
        changelog_section(ROOT / "Changelog.md", f"Companion CasparCG Kit {release_version}").replace("# ", "## ", 1),
    ]
    for folder, name, version in skills:
        section = changelog_section(folder / "CHANGELOG.md", name)
        m = re.search(rf"(?ms)^## {re.escape(version)}.*?(?=^## |\Z)", section)
        if m:
            notes += ["", f"## {name} {version}", "", m.group(0).split("\n", 1)[1].strip()]
    (DIST / "RELEASE_NOTES.md").write_text("\n".join(notes) + "\n", encoding="utf-8")

    bundle = DIST / f"Companion-CasparCG-Kit-{release_version}.zip"
    with zipfile.ZipFile(bundle, "w", zipfile.ZIP_DEFLATED) as z:
        top = f"Companion-CasparCG-Kit-{release_version}"
        z.write(tgz, f"{top}/companion-module/{tgz.name}")
        for doc in ("README.md", "LICENSE", "Changelog.md", "companion/HELP.md"):
            z.write(ROOT / doc, f"{top}/{Path(doc).name if doc != 'companion/HELP.md' else 'companion-module/HELP.md'}")
        z.write(DIST / "RELEASE_NOTES.md", f"{top}/RELEASE_NOTES.md")
        for folder, name, version in skills:
            for f in sorted(folder.rglob("*")):
                rel = f.relative_to(folder.parent)
                if f.is_file() and not {"__pycache__", "evals"} & set(rel.parts):
                    z.write(f, f"{top}/skills/{rel}")
    assets.insert(0, bundle)

    sums = [f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.name}" for p in assets]
    (DIST / "SHA256SUMS.txt").write_text("\n".join(sums) + "\n", encoding="utf-8")
    for p in assets + [DIST / "SHA256SUMS.txt", DIST / "RELEASE_NOTES.md"]:
        print(f"{p.stat().st_size:>9}  dist/{p.name}")


if __name__ == "__main__":
    main()
