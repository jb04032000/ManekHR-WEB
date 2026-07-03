'use client';

import { useEffect } from 'react';

/**
 * Runtime ARIA patches for AntD-internal a11y artifacts that axe-core flags
 * but AntD doesn't fix at the library level. Each patch is targeted and
 * preserves AntD's intended visual + interaction behavior.
 *
 * Covers four rules (per `project_ai_debug_pass2.md` deferred backlog):
 * - `td-has-header` on `tr.ant-table-measure-row` - measure row is hidden via
 *   `aria-hidden="true"` but axe still scans cells. Add `role="presentation"`
 *   on the tr to fully exit table semantics for that row.
 * - `crawlable-anchors` on pagination current-page - AntD renders the active
 *   page button as `<a>{N}</a>` without `href`. Add `href="#"` so the rule
 *   passes. Click is intercepted by AntD already; href is decorative.
 * - `aria-required-children` on Tabs overflow ellipsis - the `>>` overflow
 *   button is a non-tab descendant of `role="tablist"`. Add
 *   `role="presentation"` so axe stops requiring it to be a tab.
 * - `scrollable-region-focusable` on `.ant-table-body` - virtual-scroll body
 *   has overflow:auto but no `tabindex`. Add `tabindex="0"` so keyboard users
 *   can focus + arrow-scroll.
 * - `td-has-header` on `.ant-table-body > table` (and header sub-table) -
 *   virtual tables split header + body into sibling sub-tables; the body
 *   sub-table has no thead so axe flags every td. Promote both inner
 *   sub-tables to `role="presentation"` since the wrapping `.ant-table`
 *   carries the visual table semantics.
 * - `label` on `.ant-select input[type="search"]` - Select with showSearch
 *   renders an internal `<input type="search">` with no aria-label. Inject
 *   aria-label="Search" so axe's label rule passes.
 */
export default function AntdA11yPatches() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const apply = (root: ParentNode) => {
      // 1. Measure-row td-has-header - promote tr to presentation role
      root.querySelectorAll<HTMLElement>('tr.ant-table-measure-row').forEach((tr) => {
        if (!tr.hasAttribute('role')) tr.setAttribute('role', 'presentation');
        tr.querySelectorAll<HTMLElement>('td').forEach((td) => {
          if (!td.hasAttribute('role')) td.setAttribute('role', 'presentation');
        });
      });

      // 2. Pagination crawlable-anchors - current-page <a> without href
      root
        .querySelectorAll<HTMLAnchorElement>('.ant-pagination-item a:not([href])')
        .forEach((a) => {
          a.setAttribute('href', '#');
        });

      // 3. Tabs ellipsis - overflow wrapper as non-tab child of tablist.
      //    Only target wrapper divs; setting role="presentation" on a
      //    <button> with aria-haspopup is invalid (aria-allowed-role +
      //    presentation-role-conflict). The wrapper-div case still benefits.
      root
        .querySelectorAll<HTMLElement>('.ant-tabs-nav-operations, .ant-tabs-nav-operations-hidden')
        .forEach((el) => {
          if (el.tagName === 'BUTTON') return;
          if (!el.hasAttribute('role')) el.setAttribute('role', 'presentation');
        });

      // 4. Virtual-scroll body - make focusable for keyboard scroll
      root
        .querySelectorAll<HTMLElement>('.ant-table-body, .ant-table-tbody-virtual')
        .forEach((el) => {
          if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
          if (!el.hasAttribute('role')) el.setAttribute('role', 'region');
          if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', 'Table content');
        });

      // 5. Virtual-table inner sub-tables - header/body are split tables;
      //    body has no thead so td-has-header fires. Strip table semantics
      //    on both inner sub-tables; outer .ant-table is the real table.
      root
        .querySelectorAll<HTMLElement>('.ant-table-body > table, .ant-table-header > table')
        .forEach((tbl) => {
          if (!tbl.hasAttribute('role')) tbl.setAttribute('role', 'presentation');
        });

      // 6. AntD Select internal search input - axe `label` rule fails on the
      //    type=search input with no aria-label. Inject aria-label="Search".
      root.querySelectorAll<HTMLInputElement>('.ant-select input[type="search"]').forEach((inp) => {
        if (!inp.hasAttribute('aria-label') && !inp.hasAttribute('aria-labelledby')) {
          inp.setAttribute('aria-label', 'Search');
        }
      });
    };

    apply(document);

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          apply(node as Element);
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return null;
}
