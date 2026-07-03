import { NextRequest, NextResponse } from 'next/server';
import { serverHttp, unwrapServer } from '@/lib/api/server-client';
import { ApiEndpoints } from '@/lib/api/endpoints';
import type { Workspace, CreateWorkspacePayload } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const payload: CreateWorkspacePayload = await request.json();
    
    // Validate
    if (!payload.name || payload.name.trim().length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Workspace name is required' },
        { status: 400 }
      );
    }
    
    // Get token from Authorization header (passed from client)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const http = await serverHttp(token);
    
    const response = await http.post(ApiEndpoints.workspaces.create, payload);
    
    const data = unwrapServer<Workspace>(response);
    
    // Return plain serializable object
    const workspace: Workspace = {
      _id: String(data._id || ''),
      name: String(data.name || ''),
      businessType: data.businessType ? String(data.businessType) : undefined,
      location: data.location ? String(data.location) : undefined,
      timezone: String(data.timezone || 'UTC'),
      ownerId: String(data.ownerId || ''),
      isActive: data.isActive === true,
      isDefault: data.isDefault === true,
      designations: [],
      bankAccounts: [],
      createdAt: String(data.createdAt || new Date().toISOString()),
    };
    
    return NextResponse.json({ ok: true, data: workspace });
  } catch (e: unknown) {
    
    let errorMessage = 'Failed to create workspace';
    if (e instanceof Error) {
      errorMessage = e.message;
    }
    
    return NextResponse.json(
      { ok: false, error: errorMessage },
      { status: 500 }
    );
  }
}
