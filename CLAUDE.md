# Zari360 Connect - active build

This branch (`zari360-connect`) builds **Zari360 Connect** - the public network /
marketplace / jobs layer on top of the ERP. Multi-month, 9-phase epic.

**Before any Connect work, read `docs/connect/`.** Start with `docs/connect/README.md`,
then `docs/connect/PROGRESS.md` for the current phase + next task. That folder holds the
master plan, the binding engineering standards, the per-phase workflow, the identity
model, and the testing strategy. Do not make Connect changes - or assume project state -
without it.

---

## Code comments on add/modify (binding)

When you **add or change** any non-trivial piece (a component, action, endpoint,
schema field, or a meaningful block), leave a short comment that states:

1. **What it does** - one line of intent, not a restatement of the code.
2. **Cross-module links** - which other module/surface it talks to or depends on
   (e.g. "posts -> feed", "products live in the storefront module",
   "Message -> inbox `startInboxDm`"). Name the dependency so the next person
   knows what breaks if it changes.
3. **Anything to watch** - gotchas, invariants, or "keep in sync with X".

Keep it brief and honest (no em-dashes; see the memory rule). The goal is that
someone reading the file cold understands the piece and its connections without
tracing the whole module. Apply this to every file you touch.

---

## Route loading skeletons (binding)

**Every route that does server-side data fetching MUST ship a co-located
`loading.tsx` whose skeleton mirrors that page's real content section-for-section.**
Do not rely on the parent `app/connect/loading.tsx` shell fallback for a data
page - a generic shell skeleton that does not match the page reads as broken and
causes layout shift on swap.

Rules:

- Add `app/<route>/loading.tsx` whenever you create or substantially change a
  data-fetching route. This is part of "done", not a follow-up - apply it
  proactively without being asked.
- Mirror the real layout: same wrappers/columns/rail, same card anatomy, same
  counts/spacing, so the swap to content is shift-free.
- Server-only: no `'use client'`, no hooks. Compose the primitives in
  `components/connect/Skeleton.tsx` (`SkeletonLine`, `SkeletonButton`,
  `SkeletonCircle`, `SkeletonCard`, `SkeletonRailPanel`, ...) which use the
  shared `.skeleton` shimmer. Import them directly (not via the
  `components/connect` barrel, which pulls client components).
- Mark the root wrapper `aria-hidden`.
- Reference implementations: `app/connect/stores/loading.tsx`,
  `app/connect/companies/loading.tsx`, `app/connect/company/[slug]/loading.tsx`,
  `app/connect/pages/loading.tsx`, `app/connect/pages/[id]/loading.tsx`.

---

<!-- code-review-graph MCP tools -->

## Upload policies are generated - never hand-edit the mirror

`lib/upload-policies.ts` is a GENERATED file (machine-emitted, prettier/eslint
ignored). The single source of truth is the backend
`api/src/modules/uploads/upload-policies.ts`. To change a policy:

1. Edit the backend TS source.
2. `cd ../api && npm run export:upload-policies` (regen the JSON).
3. `npm run sync:upload-policies` here (regen `lib/upload-policies.ts`).
4. Commit all three artifacts together.

FE-only pre-check helpers (`getUploadPolicy`, `getAcceptAttr`, `preCheckUpload`)
live in the hand-authored `lib/upload-policies.helpers.ts` and import the
generated data. A parity test (`lib/upload-policies.parity.vitest.ts`) fails if
the mirror drifts from the backend JSON.

## Module Engineering Playbook

Before bringing a new module up to the platform bar (RBAC + scope + field-group
gating + friendly errors + FE-mirrors-BE), read
[`../MODULE-PLAYBOOK.md`](../MODULE-PLAYBOOK.md) - the reusable per-module
architecture standard distilled from the Team rebuild. It names the canonical
Team file to copy for each pattern.

## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool                        | Use when                                               |
| --------------------------- | ------------------------------------------------------ |
| `detect_changes`            | Reviewing code changes - gives risk-scored analysis    |
| `get_review_context`        | Need source snippets for review - token-efficient      |
| `get_impact_radius`         | Understanding blast radius of a change                 |
| `get_affected_flows`        | Finding which execution paths are impacted             |
| `query_graph`               | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes`     | Finding functions/classes by name or keyword           |
| `get_architecture_overview` | Understanding high-level codebase structure            |
| `refactor_tool`             | Planning renames, finding dead code                    |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.

## AntD API conventions (BANNED deprecated forms)

This codebase is on **Ant Design v6** (`antd@6.x`). The legacy component APIs below are **deprecated and produce console warnings on every render**. Future code review WILL reject any PR introducing them. Always use the required form.

### v4 -> v5 legacy (still banned)

| Component    | BANNED (v4 legacy)                                                                                          | REQUIRED                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `<Alert>`    | `message={...}`                                                                                             | `title={...}` (keep `description=`, `type=`, `showIcon`, `icon`, `closable`, etc.) |
| `<Tabs>`     | `<TabPane key label>...</TabPane>` children, `Tabs.TabPane`, `const { TabPane } = Tabs;`                    | `<Tabs items={[{ key, label, children }]} />`                                      |
| `<Dropdown>` | `overlay={<Menu items=.../>}`                                                                               | `menu={{ items: [...] }}`                                                          |
| `<Collapse>` | `<Collapse.Panel header key>...</Collapse.Panel>` children, `Collapse.Panel`, `const { Panel } = Collapse;` | `<Collapse items={[{ key, label, children, style?, extra? }]} />`                  |
| `<Modal>`    | `visible={...}`                                                                                             | `open={...}`                                                                       |
| `<Drawer>`   | `visible={...}`                                                                                             | `open={...}`                                                                       |

### v5 -> v6 deprecations (NEW - these caused the repeat console warnings)

| Component                                                                                       | BANNED (v5 form)                                                                       | REQUIRED (v6)                                                                 |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| `<Drawer>`                                                                                      | `width={n}` / `height={n}`                                                             | `size={n}` (`size` accepts a number, string, or `'default'`/`'large'`)        |
| `<InputNumber>`                                                                                 | `addonAfter=` / `addonBefore=`                                                         | `suffix=` / `prefix=` (or wrap in `<Space.Compact>` for a bordered addon box) |
| `<Modal>` / `<Drawer>`                                                                          | `destroyOnClose`                                                                       | `destroyOnHidden`                                                             |
| `<Tooltip>` / `<Popover>`                                                                       | `overlayStyle=` / `overlayClassName=` / `overlayInnerStyle=`                           | `styles={{ root, body }}` / `classNames={{ root }}`                           |
| `<DatePicker>` / `<Select>` / `<TimePicker>` / `<Cascader>` / `<TreeSelect>` / `<AutoComplete>` | `popupStyle=` / `popupClassName=` (and legacy `dropdownStyle=` / `dropdownClassName=`) | `styles={{ popup: { root } }}` / `classNames={{ popup: { root } }}`           |

Note: `<Modal width={n}>` is NOT deprecated - only `<Drawer>` moved `width` -> `size`. `addonAfter`/`addonBefore` on plain `<Input>` are fine; only `<InputNumber>` deprecated them.

Reference migrations:

- `<Alert title=>` -> `components/dashboard/team/form/MobileClassificationBanner.tsx`
- `<Tabs items=>` -> `app/dashboard/bills/page.tsx`
- `<Collapse items=>` -> `components/rbac/PermissionGrid.tsx`, `components/finance/loans/AmortisationPreviewCard.tsx`
- `<Drawer size=>` + `<InputNumber suffix=>` -> `components/dashboard/loans/LoanDetailDrawer.tsx`, `components/dashboard/loans/CreateLoanDrawer.tsx`
- `destroyOnHidden` -> `app/dashboard/salary/components/salary/ComplianceOverrideModal.tsx`

A `no-restricted-syntax` lint rule (error level) enforces the v6 set under `app/dashboard/salary/**`, `components/dashboard/loans/**`, `features/salary/**`, `components/dashboard/team/salary/**`, and `components/dashboard/team/attendance/**` (see `eslint.config.mjs`) so it cannot silently recur in the payroll/attendance member surfaces.

### Modal / Drawer behaviour (binding — apply to EVERY modal)

1. **Tall content scrolls INSIDE the body, never the whole modal.** Any `<Modal>` whose content can exceed the viewport MUST cap its body and scroll it internally so the title + footer stay fixed and the page/modal never scrolls as one block. Use the v6 `styles.body` (never the deprecated `bodyStyle`), and pair with `centered`:
   `<Modal centered styles={{ body: { maxHeight: '65vh', overflowY: 'auto' } }}>`.
   `<Drawer>` bodies already scroll; only add a body `maxHeight` when you pin a sticky footer. Reference: `components/ui/FeedbackScreenCapture.tsx`.

2. **Stateful forms reset on close.** A Modal/Drawer/Popover hosting a form MUST open clean every time. Give the overlay `destroyOnHidden` (body unmounts + remounts fresh) AND/OR explicitly reset the form state on submit/close. Never rely on a closed-but-mounted overlay - it keeps stale values. Reference: `components/ui/FeedbackButton.tsx` (Popover `destroyOnHidden`) + `components/ui/FeedbackPanel.tsx` (reset on submit success).

Quick self-check before opening a PR: `rg -n "<Alert[^>]*message=|<TabPane|Tabs\.TabPane|Collapse\.Panel|<Panel\b|overlay=\{|<Modal[^>]*visible=|<Drawer[^>]*visible=|<Drawer[^>]*width=|addonAfter=|addonBefore=|destroyOnClose|overlayStyle=|overlayClassName=|popupStyle=|popupClassName=|dropdownStyle=|dropdownClassName=" -t tsx -t ts` should return zero matches in changed files.
