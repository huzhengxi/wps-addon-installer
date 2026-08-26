#!/usr/bin/env python3

"""Create and push a versioned release commit and Git tag."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
TAURI_CONFIG = ROOT / "src-tauri" / "tauri.conf.json"
SEMVER = re.compile(
    r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
    r"(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?"
    r"(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$"
)
RELEASE_VERSION = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")


def run(*command: str, capture_output: bool = False) -> str:
    result = subprocess.run(
        command,
        cwd=ROOT,
        check=True,
        text=True,
        capture_output=capture_output,
    )
    return result.stdout.strip() if capture_output else ""


def fail(message: str) -> None:
    print(message, file=sys.stderr)
    raise SystemExit(1)


def load_tauri_config() -> dict[str, object]:
    with TAURI_CONFIG.open(encoding="utf-8") as file:
        return json.load(file)


def next_patch_version() -> str:
    current = load_tauri_config().get("version")
    if not isinstance(current, str):
        fail("src-tauri/tauri.conf.json must contain a string version.")

    match = RELEASE_VERSION.fullmatch(current)
    if not match:
        fail(f"Cannot increment non-release version: {current}")

    major, minor, patch = match.groups()
    return f"{major}.{minor}.{int(patch) + 1}"


def ensure_clean_worktree() -> None:
    if run("git", "status", "--porcelain", capture_output=True):
        fail("Working tree is not clean. Commit or stash existing changes before creating a release.")


def ensure_new_tag(tag: str) -> None:
    if subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"refs/tags/{tag}"], cwd=ROOT
    ).returncode == 0:
        fail(f"Local tag {tag} already exists.")

    if subprocess.run(
        ["git", "ls-remote", "--exit-code", "--tags", "origin", f"refs/tags/{tag}"], cwd=ROOT
    ).returncode == 0:
        fail(f"Remote tag {tag} already exists.")


def update_tauri_version(version: str) -> None:
    config = load_tauri_config()
    config["version"] = version
    TAURI_CONFIG.write_text(f"{json.dumps(config, indent=2, ensure_ascii=False)}\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Update application versions, create a release commit and push its Git tag."
    )
    parser.add_argument(
        "version",
        nargs="?",
        help="Version to release, such as 0.2.0. Omit it to increment the Tauri patch version.",
    )
    arguments = parser.parse_args()

    version = (arguments.version or next_patch_version()).removeprefix("v")
    if not SEMVER.fullmatch(version):
        fail("Version must be valid semantic version, for example: 0.1.1 or 0.1.1-rc.1")

    ensure_clean_worktree()

    try:
        branch = run("git", "symbolic-ref", "--quiet", "--short", "HEAD", capture_output=True)
    except subprocess.CalledProcessError:
        fail("A release must be created from a branch, not a detached HEAD.")

    try:
        run("git", "remote", "get-url", "origin", capture_output=True)
    except subprocess.CalledProcessError:
        fail("The git remote 'origin' is required.")

    tag = f"v{version}"
    ensure_new_tag(tag)

    # This also keeps package-lock.json project metadata in sync with package.json.
    run("npm", "version", version, "--no-git-tag-version", "--ignore-scripts")
    update_tauri_version(version)

    run("git", "diff", "--check")
    run("git", "add", "--", "package.json", "package-lock.json", "src-tauri/tauri.conf.json")
    run("git", "commit", "-m", f"chore(release): {tag}")
    run("git", "tag", "-a", tag, "-m", tag)
    run("git", "push", "origin", f"HEAD:refs/heads/{branch}", f"refs/tags/{tag}")

    print(f"Released {tag}. The tag workflow will build and publish the installers.")


if __name__ == "__main__":
    main()
