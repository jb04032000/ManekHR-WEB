import { useWorkspaceStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useWorkspace(redirect = true) {
  const router = useRouter();
  const { currentWorkspaceId, currentWorkspace, workspaces, setCurrentWorkspaceId } = useWorkspaceStore();

  useEffect(() => {
    if (redirect && !currentWorkspaceId) {
      router.replace('/dashboard/workspace');
    }
  }, [currentWorkspaceId, redirect, router]);

  return { currentWorkspaceId: currentWorkspaceId ?? '', currentWorkspace, workspaces, setCurrentWorkspaceId, hasWorkspace: !!currentWorkspaceId };
}
