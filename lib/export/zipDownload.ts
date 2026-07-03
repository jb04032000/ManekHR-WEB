export async function downloadAsZip(
  files: { blob: Blob; filename: string }[],
  zipFilename: string,
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  files.forEach(({ blob, filename }) => {
    zip.file(filename, blob);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = zipFilename;
  anchor.click();
  URL.revokeObjectURL(url);
}
