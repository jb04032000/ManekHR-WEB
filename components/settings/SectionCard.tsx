interface SectionCardProps {
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Card-shaped section block within a settings page. Heading rests on a
 * thin baseline divider; body sits below. Used in place of AntD Card so
 * the heading + meta line pattern stays consistent across pages.
 */
export function SectionCard({ title, description, trailing, children }: SectionCardProps) {
  return (
    <section className="mb-6 rounded-[14px] border border-border bg-surface px-6 py-5 last:mb-0">
      <header className="mb-5 flex items-start justify-between gap-4 border-b border-border-light pb-4">
        <div className="min-w-0">
          <h2
            style={{ marginTop: 0, marginBottom: description ? 4 : 0, lineHeight: 1.3 }}
            className="font-display text-[16px] font-bold text-heading"
          >
            {title}
          </h2>
          {description && (
            <p
              style={{ marginTop: 0, marginBottom: 0, lineHeight: 1.5 }}
              className="text-[13px] text-muted"
            >
              {description}
            </p>
          )}
        </div>
        {trailing && <div className="flex-shrink-0">{trailing}</div>}
      </header>
      {children}
    </section>
  );
}
