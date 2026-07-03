interface SectionHeaderProps {
  title: string;
  description?: string;
  trailing?: React.ReactNode;
}

/**
 * Title + meta line shown above each settings section. Drops the AntD Card
 * header in favour of a flatter hierarchy that matches the reference design.
 */
export function SectionHeader({ title, description, trailing }: SectionHeaderProps) {
  return (
    <header className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0">
        <h1
          style={{ marginTop: 0, marginBottom: 4, lineHeight: 1.2 }}
          className="font-display text-[28px] font-bold text-heading"
        >
          {title}
        </h1>
        {description && (
          <p
            style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}
            className="text-[14px] text-muted"
          >
            {description}
          </p>
        )}
      </div>
      {trailing && <div className="flex-shrink-0">{trailing}</div>}
    </header>
  );
}
