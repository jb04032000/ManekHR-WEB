/** One cell in a value-proposition grid: gold rule, serif title, paragraph. */
export function ValueProp({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <span
        className="block h-[3px] w-9 rounded-full"
        style={{ background: 'var(--cr-gold-500)' }}
        aria-hidden="true"
      />
      <h3 className="pt-5 text-[1.18rem]">{title}</h3>
      <p className="pt-2 text-[0.975rem] leading-relaxed text-pretty text-[var(--cr-neutral-600)]">
        {body}
      </p>
    </div>
  );
}
