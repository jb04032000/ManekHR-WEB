/**
 * Renders a JSON-LD structured-data block. Schema content is crawler-facing
 * and therefore always English - never localized.
 */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // Static, build-time object - safe to inline.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
