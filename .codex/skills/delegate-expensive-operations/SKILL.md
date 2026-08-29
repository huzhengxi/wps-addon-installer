---
name: delegate-expensive-operations
description: Coordinate project work when the user wants to run slow builds, tests, packaging, or high-volume diagnostics themselves. Use for this repository's implementation and verification tasks; do not use for small local inspections.
---

# Delegate Expensive Operations

The user prefers to perform comparatively slow or token-heavy operations and report the result back. Respect that preference throughout work in this repository.

## What to delegate

Do not run these unless the user explicitly changes this preference:

- compilation, builds, and packaging, including `npm run build`, `npm run check`, `npm run package:*`, and Tauri build/bundle commands;
- complete test suites, long-running integration checks, dependency installation, and heavyweight static analysis;
- commands likely to create large logs, such as recursive diagnostics or verbose build output.

You may still make ordinary source edits and perform focused, read-only inspections that are quick and produce concise output.

## How to hand work to the user

At the appropriate verification point, give the user a copyable command, a brief reason for running it, and the exact result to return. Prefer the project's npm scripts over reconstructed commands.

For example:

```text
请在项目根目录运行 `npm run build`。成功时只需回复“通过”；失败时请贴出报错及其前后约 30 行。
```

Ask for the smallest useful result. Do not ask the user to paste a successful full build log, lockfile diff, or other bulky output. For failures, request the error message, relevant nearby lines, command exit status when available, and any generated artifact path only if it matters.

## After the user responds

Treat the reported result as the verification evidence. Diagnose a failure from the supplied output and make focused fixes; request a rerun only when the change could affect the reported failure. In the final handoff, clearly state which expensive verification remains user-run or has been confirmed by the user.
