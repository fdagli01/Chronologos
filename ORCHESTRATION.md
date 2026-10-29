# Chronologos agent workflow

The user prefers Codex to coordinate work and delegate bounded tasks to Luna and Antigravity agents without unnecessary intermediate confirmations. On 2026-10-04, the user asked to narrow blanket permissions while preserving this workflow.

- Codex owns task breakdown, file ownership, integration, verification, and final reporting.
- Use available `gpt-6-luna` subagents for small investigations and bounded implementation tasks. Send a brief and relevant paths rather than the full conversation. Require concise results.
- Antigravity is an external worker. Use the standalone CLI at `C:/Users/fdagl/AppData/Local/agy/bin/agy.exe`.
- Complete authorized work autonomously within the active permissions. Do not use `--dangerously-skip-permissions` for routine delegation, grant blanket PowerShell/agy execution, or bypass denied operations.
- Codex uses workspace-write with on-request approvals and automatic review of eligible escalations. This does not guarantee approval of every action or override the active session's managed constraints.
- Run Antigravity workers in a separate task workspace or source copy with only necessary source and the task brief. Exclude personal databases, credentials, dependencies/build artifacts unless required, and avoid sharing a writable folder with another worker. A source copy alone is not an OS security boundary.
- Keep Antigravity outside-workspace file access disabled. Workspace file tools can handle bounded source edits; shell operations keep normal permission checks. The coordinator runs necessary build/verification commands within Codex's active sandbox, rather than granting a worker unrestricted shells.
- Protect the installed Chronologos archive, `server/data`, and credential/configuration directories. Task briefs specify allowed writes; the coordinator reviews actual diffs before integrating changes.
- Give each worker an explicit goal, allowed files, acceptance criteria, and result-file path. Assign disjoint files to concurrent editors; run dependent tasks sequentially.
- Results must state completed work, changed paths, verification performed, and blockers. Keep results short. Codex reads the results and reviews the actual changes.
- For headless Antigravity reviews, request a concise final response through `--output-format json`; Codex saves the report. Worker report-file writes can be denied because headless mode cannot prompt. Do not widen permissions merely to save a report. If this happens, make one follow-up in the same conversation requesting synthesis without further tool calls.
- Read `HANDOFF.md`, `README.md`, and relevant parts of `PROJECT_PLAN.md` before feature work. Preserve personal SQLite data. Do not reset or seed the user's archive.
- Delegation reduces main-thread context growth; it does not guarantee lower aggregate usage.
- For static translation tasks, pass the complete string batch directly in the Antigravity prompt and require JSON-only output without tools or subagents. The coordinator validates exact keys and placeholders before writing dictionaries. This avoids headless shell approval failures and speculative replacement code. If a coding worker cannot inspect the source, reject invented rewrites and use a local bounded implementation instead.

## Connection check

Task: `agent-tasks/antigravity-connect.md`.
Expected result: `agent-tasks/antigravity-connect-result.md`.
Luna is available through Codex's subagent tools. Antigravity CLI model listing works. The original IDE handshake remains unsuccessful. On 2026-10-04, the standalone CLI completed the `antigravity-test.txt` task with Gemini 3.8 Flash (Low), and Codex verified the file exists with zero bytes. The CLI reported 105,919 total tokens for this small test; do not assume delegation is cheap. Measure usage and investigate context loading before broad Antigravity delegation.

## Review experiment (2026-10-04)

- Gemini 3.8 Flash (Medium) reviewed an isolated temporary snapshot containing 14 files and 168,461 bytes. Personal databases, dependencies, binaries, and build outputs were excluded. Frontend excerpts cover only their first 220 lines; migration SQL was not in the snapshot.
- The first request timed out after 180 seconds with an empty response. A follow-up in the same conversation requested immediate synthesis without further tool use and returned a report.
- `agent-tasks/antigravity-project-review-final.json` contains the completed response and cumulative usage: 478,309 total tokens, 1,003,778 cache-read tokens. Do not add initial and final usage counters from the same conversation. Cached usage and account quota impact are distinct and were not verified here.
- The CLI warned that `--mode plan` has no effect with `--disable-slash-commands`; do not describe that combination as enforced read-only mode. The prompt requested no edits and the agent worked on a disposable source copy.
- The raw report is `agent-tasks/antigravity-project-review.md`. Luna completed source verification: the FK deletion and operator-precedence bug claims were rejected; retained incomplete reading sessions are observable but not established as a bug. The corrected report is `agent-tasks/verified-project-review.md`. Do not implement raw external findings automatically.
- A smaller snapshot alone did not establish low aggregate usage. For future cost-focused delegation, prefer narrow questions and measure actual counters before broad review jobs.
