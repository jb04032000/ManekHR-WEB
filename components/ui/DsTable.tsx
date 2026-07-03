'use client';
import { useState } from 'react';
import { Table, Empty, Button } from 'antd';
import type { TableProps, TablePaginationConfig } from 'antd';
import type { Key } from 'react';

const DEFAULT_PAGE_SIZE = 15;
const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];

export interface DsTableProps<T extends object = object> extends Omit<
  TableProps<T>,
  'scroll' | 'sticky' | 'rowSelection' | 'footer'
> {
  /** Enable checkbox row selection. Pass selectedRowKeys to control selection. */
  selectedRowKeys?: Key[];
  onSelectionChange?: (keys: Key[], rows: T[]) => void;
  /**
   * Builds the aria-label for each row's selection checkbox so screen readers
   * announce what they're selecting. Defaults to `Select row` - pass a
   * function returning a meaningful descriptor (e.g. `(m) => `Select ${m.name}``)
   * for stronger context. Required-by-axe-core and improves keyboard users'
   * ability to navigate bulk-action tables.
   */
  rowSelectionLabel?: (record: T) => string;
  /** Width of horizontal scroll area (number in px, or CSS string). Defaults to 'max-content'. */
  scrollX?: number | string | true;
  /** Height of vertical scroll area - enables sticky header when set. */
  scrollY?: number | string;
  /**
   * Sticky header config. Defaults to true (sticks to viewport top).
   * Pass { offsetHeader: N } if you have a fixed navbar of height N.
   */
  sticky?: boolean | { offsetHeader?: number };
  /**
   * Renders a "Show all X records / Switch to paged view" toggle in the table footer.
   * When the user switches to "show all", pagination is disabled entirely (no size-changer,
   * no quick-jumper, no NaN). Clicking "Switch to paged view" restores normal pagination.
   *
   * NOTE: This occupies the table footer slot; the `footer` prop is intentionally omitted
   * from DsTableProps when showAllOption is in use.
   */
  showAllOption?: boolean;
}

/**
 * DsTable - shared, reusable table built on Ant Design Table.
 *
 * Features:
 *  - Sticky header (sticky prop)
 *  - Pagination with size-changer, quick-jumper, and total record count
 *  - Responsive horizontal scrolling
 *  - Sortable columns - add `sorter` to any column definition:
 *      { title: 'Name', dataIndex: 'name', sorter: (a, b) => a.name.localeCompare(b.name) }
 *  - Row selection for bulk actions (opt-in via onSelectionChange)
 *  - Loading and empty states
 *  - Fixed/sticky columns via fixed: 'left' | 'right' in column defs
 *
 * Disable pagination entirely:
 *   <DsTable ... pagination={false} />
 *
 * Show all records toggle (footer link):
 *   <DsTable ... showAllOption />
 */
export function DsTable<T extends object = object>({
  columns,
  dataSource,
  loading,
  rowKey = 'id',
  pagination,
  selectedRowKeys,
  onSelectionChange,
  rowSelectionLabel,
  scrollX = 'max-content',
  scrollY,
  sticky = true,
  showAllOption = false,
  size = 'middle',
  locale,
  ...rest
}: DsTableProps<T>) {
  const [showAll, setShowAll] = useState(false);

  // Track whichever page size is currently active so the footer toggle only
  // appears when records actually overflow the visible page.
  const externalPageSize =
    typeof pagination === 'object' && pagination?.pageSize
      ? (pagination.pageSize as number)
      : DEFAULT_PAGE_SIZE;
  const [currentPageSize, setCurrentPageSize] = useState(externalPageSize);

  const totalRecords = Array.isArray(dataSource) ? dataSource.length : 0;

  // Separate out onShowSizeChange so we can intercept it to track page size.
  const { onShowSizeChange: externalOnShowSizeChange, ...restPagConfig } = (
    typeof pagination === 'object' ? pagination : {}
  ) as Partial<TablePaginationConfig> & {
    onShowSizeChange?: (current: number, size: number) => void;
  };

  // When showAll is active, disable pagination entirely - no pageSizeOptions, no NaN.
  const resolvedPagination: false | TablePaginationConfig =
    pagination === false || showAll
      ? false
      : {
          defaultPageSize: DEFAULT_PAGE_SIZE,
          pageSizeOptions: PAGE_SIZE_OPTIONS.map(String),
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total: number, range: [number, number]) =>
            `${range[0]}–${range[1]} of ${total}`,
          ...restPagConfig,
          onShowSizeChange: (current: number, size: number) => {
            setCurrentPageSize(size);
            externalOnShowSizeChange?.(current, size);
          },
        };

  // Only render the footer toggle when records actually overflow the current page.
  // If everything already fits (e.g. 4 records, 15-per-page default), the toggle
  // is pointless and should stay hidden.
  const showFooter = showAllOption && (showAll || totalRecords > currentPageSize);

  const footer = showFooter
    ? () => (
        <div className="flex items-center justify-end gap-1 text-xs text-faint">
          {showAll ? (
            <>
              Showing all {totalRecords} records
              <Button
                type="link"
                size="small"
                className="ml-1 !h-auto !p-0 !text-xs !leading-none"
                onClick={() => setShowAll(false)}
              >
                Switch to paged view
              </Button>
            </>
          ) : (
            <Button
              type="link"
              size="small"
              className="!h-auto !p-0 !text-xs !leading-none"
              onClick={() => setShowAll(true)}
            >
              Show all {totalRecords} records
            </Button>
          )}
        </div>
      )
    : undefined;

  // axe-core flags `.ant-checkbox-input` cells with no associated label.
  // AntD doesn't set an aria-label on per-row selection checkboxes by default,
  // so we supply one via getCheckboxProps. The `aria-label` IS spread onto the
  // underlying <input>, but AntD's CheckboxProps type doesn't expose it; cast
  // the whole rowSelection object to any to skip the type-only mismatch.
  //
  // Do NOT set `columnTitle` here: passing a node replaces AntD's header
  // "select all" checkbox entirely, which silently removes the select-all
  // affordance. We keep the native select-all and only label the per-row boxes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rowSelection: any = onSelectionChange
    ? {
        selectedRowKeys,
        onChange: onSelectionChange,
        preserveSelectedRowKeys: true,
        getCheckboxProps: (record: T) => ({
          'aria-label': rowSelectionLabel ? rowSelectionLabel(record) : 'Select row',
        }),
      }
    : undefined;

  return (
    <Table<T>
      columns={columns}
      dataSource={dataSource}
      loading={loading}
      rowKey={rowKey}
      size={size}
      pagination={resolvedPagination}
      rowSelection={rowSelection}
      scroll={{ x: scrollX, y: scrollY }}
      sticky={sticky}
      footer={footer}
      locale={{
        emptyText: <Empty description="No records found" image={Empty.PRESENTED_IMAGE_SIMPLE} />,
        ...locale,
      }}
      {...rest}
    />
  );
}

export default DsTable;
