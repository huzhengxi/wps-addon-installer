#!/usr/bin/env python3

"""创建并推送带版本号的发布提交及 Git tag。"""

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
        fail("src-tauri/tauri.conf.json 必须包含字符串形式的 version。")

    match = RELEASE_VERSION.fullmatch(current)
    if not match:
        fail(f"无法自增非发布版本号：{current}")

    major, minor, patch = match.groups()
    return f"{major}.{minor}.{int(patch) + 1}"


def ensure_clean_worktree() -> None:
    if run("git", "status", "--porcelain", capture_output=True):
        fail("工作区不干净，请先提交或暂存现有改动再发版。")


def ensure_new_tag(tag: str) -> None:
    if subprocess.run(
        ["git", "rev-parse", "--verify", "--quiet", f"refs/tags/{tag}"], cwd=ROOT
    ).returncode == 0:
        fail(f"本地 tag {tag} 已存在。")

    if subprocess.run(
        ["git", "ls-remote", "--exit-code", "--tags", "origin", f"refs/tags/{tag}"], cwd=ROOT
    ).returncode == 0:
        fail(f"远端 tag {tag} 已存在。")


def update_tauri_version(version: str) -> None:
    config = load_tauri_config()
    config["version"] = version
    TAURI_CONFIG.write_text(f"{json.dumps(config, indent=2, ensure_ascii=False)}\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="更新应用版本号，创建发布提交并推送 Git tag，"
        "可选地将 release note 作为 tag 注释消息附带。"
    )
    parser.add_argument(
        "version",
        nargs="?",
        help="要发布的版本号，可带或不带前缀 v，如 0.2.0 或 v0.2.0；"
        "省略时自动对 Tauri patch 版本号自增。",
    )
    parser.add_argument(
        "-m",
        "--message",
        default=None,
        help="作为 tag 注释消息附带的 release note；省略时默认使用版本号（如 0.1.2）。",
    )
    arguments = parser.parse_args()

    version = (arguments.version or next_patch_version()).removeprefix("v")
    if not SEMVER.fullmatch(version):
        fail("版本号必须是合法的语义化版本，例如：0.1.1 或 0.1.1-rc.1")

    ensure_clean_worktree()

    try:
        branch = run("git", "symbolic-ref", "--quiet", "--short", "HEAD", capture_output=True)
    except subprocess.CalledProcessError:
        fail("发布必须从分支创建，不能在 detached HEAD 状态下进行。")

    try:
        run("git", "remote", "get-url", "origin", capture_output=True)
    except subprocess.CalledProcessError:
        fail("需要配置 git remote 'origin'。")

    tag = f"v{version}"
    ensure_new_tag(tag)
    notes = arguments.message or version

    # 同时让 package-lock.json 的项目元信息与 package.json 保持一致。
    run("npm", "version", version, "--no-git-tag-version", "--ignore-scripts")
    update_tauri_version(version)

    run("git", "diff", "--check")
    run("git", "add", "--", "package.json", "package-lock.json", "src-tauri/tauri.conf.json")
    run("git", "commit", "-m", f"chore(release): {tag}")
    run("git", "tag", "-a", tag, "-m", notes)
    run("git", "push", "origin", f"HEAD:refs/heads/{branch}", f"refs/tags/{tag}")

    print(f"已发布 {tag}。tag 工作流将构建并上传安装包。")


if __name__ == "__main__":
    main()
