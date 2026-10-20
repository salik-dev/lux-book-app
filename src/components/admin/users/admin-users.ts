import { supabase } from '@/integrations/supabase/client';

export type AdminRole = 'admin' | 'super_admin';

export interface AdminUser {
  id: string;
  username: string | null;
  email: string;
  role: AdminRole;
  is_active: boolean | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Admin',
  super_admin: 'Super Admin',
};

type ManageResult<T> = { data: T | null; error: string | null };

/**
 * Calls the super-admin-gated `admin-manage-users` edge function. supabase-js
 * surfaces non-2xx responses as errors with a Response in `context`; we read the
 * JSON body from it so the user still sees the friendly server message.
 */
async function invokeManage<T>(action: string, payload: Record<string, unknown> = {}): Promise<ManageResult<T>> {
  const { data, error } = await supabase.functions.invoke('admin-manage-users', {
    body: { action, ...payload },
  });

  if (error) {
    let message = 'Something went wrong. Please try again.';
    const resp = (error as { context?: Response }).context;
    if (resp && typeof resp.json === 'function') {
      try {
        const body = await resp.json();
        if (body?.message) message = body.message;
      } catch {
        // keep the generic message
      }
    }
    return { data: null, error: message };
  }

  if (data?.error) {
    return { data: null, error: data.message ?? 'Request failed. Please try again.' };
  }

  return { data: data as T, error: null };
}

export function listAdminUsers() {
  return invokeManage<{ success: true; users: AdminUser[] }>('list');
}

export function createAdminUser(input: { username: string; email: string; role: AdminRole }) {
  return invokeManage<{ success: true; user: AdminUser }>('create', input);
}

export function updateAdminUser(input: { id: string; username: string; email: string; role: AdminRole }) {
  return invokeManage<{ success: true; user: AdminUser }>('update', input);
}

export function deleteAdminUser(id: string) {
  return invokeManage<{ success: true }>('delete', { id });
}
