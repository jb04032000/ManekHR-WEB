import KioskClient from './KioskClient';

export const dynamic = 'force-dynamic';

export default async function KioskPage({
  params,
}: {
  params: Promise<{ wsId: string; secret: string }>;
}) {
  const { wsId, secret } = await params;
  return <KioskClient wsId={wsId} secret={secret} />;
}
