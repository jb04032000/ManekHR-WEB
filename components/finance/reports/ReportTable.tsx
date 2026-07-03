'use client';
import { Table } from 'antd';
import type { ColumnsType, TableProps } from 'antd/es/table';

interface ReportTableProps<T> extends Omit<TableProps<T>, 'columns'> {
  columns: ColumnsType<T>;
}

export function ReportTable<T extends object>({ columns, ...rest }: ReportTableProps<T>) {
  const enhancedColumns = columns.map((col) => ({
    ...col,
    onHeaderCell: () => ({
      style: {
        fontFamily: 'var(--font-display)',
        fontSize: 12,
        textTransform: 'uppercase' as const,
        letterSpacing: '0.03em',
      },
    }),
  }));

  return (
    <Table<T>
      columns={enhancedColumns}
      scroll={{ x: 'max-content' }}
      sticky
      pagination={rest.pagination ?? { pageSize: 100, showSizeChanger: true }}
      size="small"
      {...rest}
    />
  );
}
