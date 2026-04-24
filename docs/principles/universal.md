# Universal Code Principles

These principles apply to all projects regardless of language or domain. They are the default rules — exceptions must be intentional and documented in PR notes.

## Principles

- **Correctness first**: Prefer explicit, sound solutions over speed of implementation. Verify behavior before marking work complete.
- **Strong defaults, documented exceptions**: Follow the rules below by default. Any deviation must be justified in PR notes with rationale.
- **Cohesive file responsibility**: Each file owns one clear responsibility. Avoid mixing unrelated concerns in a single file.
- **File size limit**: Keep production source files at or below **400 lines**. Split when growth impacts readability or testability.
- **Function size**: Keep functions under **50 lines**. If a function does more than one logical operation, extract the parts.
- **Function complexity**: Limit nesting depth to **3 levels**. Prefer early returns, guard clauses, and decomposition over deeply nested conditionals.
- **Comments policy**: Prefer self-explanatory code. Comments explain *intent*, *invariants*, or *non-obvious tradeoffs* — never restate what the code already says.
- **Testing is risk-based**: Add or update tests proportional to risk and blast radius. Not every change needs a test, but risky changes always do.
- **No silent scope expansion**: Stay within the assigned task. Discovered work gets its own issue, not a drive-by fix.
- **CI enforcement**: Automated checks (lint, typecheck, tests) are authoritative. They must pass before merge.

## Universal PR Checklist

- [ ] Correctness validated; no avoidable unsafe patterns.
- [ ] Defaults followed; any exception justified in PR notes.
- [ ] Files remain cohesive and under 400 lines.
- [ ] Functions are under 50 lines, nesting under 3 levels.
- [ ] Comments only for intent/invariants/tradeoffs.
- [ ] Tests added/updated proportional to risk.
- [ ] Lint and tests pass.
