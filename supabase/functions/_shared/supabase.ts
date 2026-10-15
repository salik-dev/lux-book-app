import { createClient, type SupabaseClient, type User } from "npm:@supabase/supabase-js@2.58.0";
import { HttpError, requireEnv } from "./http.ts";

export type AdminClient = SupabaseClient;

/** Service-role client. Bypasses RLS, so every query must enforce ownership itself. */
export function createAdminClient(): AdminClient {
  return createClient(requireEnv("SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * The signed-in user, or null for guests. Guests' requests carry the public anon key,
 * which is not a user session, so a failed lookup simply means "no user".
 */
export async function optionalUser(req: Request, admin: AdminClient): Promise<User | null> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : data.user;
}

/** Resolves the signed-in user from the request's bearer token, or fails with 401. */
export async function requireUser(req: Request, admin: AdminClient): Promise<User> {
  const header = req.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new HttpError(401, "UNAUTHENTICATED", "Please sign in to continue.");

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "UNAUTHENTICATED", "Your session has expired. Please sign in again.");
  return data.user;
}

/**
 * Resolves the signed-in user and requires an active `admin_users` row (matched by
 * user_id, or by email for admins whose row hasn't been linked yet), else 401/403.
 */
export async function requireAdmin(req: Request, admin: AdminClient): Promise<User> {
  const user = await requireUser(req, admin);

  const { data: byId } = await admin.from("admin_users").select("is_active").eq("user_id", user.id).maybeSingle();
  let isActive = byId?.is_active === true;
  if (!byId && user.email) {
    const { data: byEmail } = await admin.from("admin_users").select("is_active").eq("email", user.email).maybeSingle();
    isActive = byEmail?.is_active === true;
  }

  if (!isActive) throw new HttpError(403, "FORBIDDEN", "You don't have permission to do this.");
  return user;
}
