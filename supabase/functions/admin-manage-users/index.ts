// -----------------------------------------------------------------------------
// admin-manage-users
//
// Super-admin-only CRUD for admin_users. Uses the service role internally but
// first verifies the caller is an active super_admin. Creating an admin also
// provisions a passwordless (email-confirmed) auth user; deleting one removes it.
// Actions: list | create | update | delete
// -----------------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = new Set(["admin", "super_admin"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

/** Public-safe shape returned to the client (never exposes OTP columns). */
const PUBLIC_COLUMNS = "id, username, email, role, is_active, user_id, created_at, updated_at";

function cleanStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Authenticate caller and require active super_admin.
    const authHeader = req.headers.get("Authorization") || "";
    const userJwt = authHeader.replace("Bearer ", "").trim();
    if (!userJwt) return json({ error: "unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(userJwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const callerId = userData.user.id;
    const callerEmail = userData.user.email?.toLowerCase() ?? "";

    let { data: caller } = await admin
      .from("admin_users")
      .select("id, role, is_active, user_id")
      .eq("user_id", callerId)
      .maybeSingle();

    if ((!caller || !caller.is_active) && callerEmail) {
      const { data: byEmail } = await admin
        .from("admin_users")
        .select("id, role, is_active, user_id")
        .ilike("email", callerEmail)
        .maybeSingle();
      caller = byEmail ?? caller;
    }

    if (!caller || !caller.is_active || caller.role !== "super_admin") {
      return json({ error: "forbidden", message: "Only a super admin can manage users." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = cleanStr(body.action);

    // 2. LIST -----------------------------------------------------------------
    if (action === "list") {
      const { data, error } = await admin
        .from("admin_users")
        .select(PUBLIC_COLUMNS)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, users: data ?? [] });
    }

    // 3. CREATE ---------------------------------------------------------------
    if (action === "create") {
      const username = cleanStr(body.username);
      const email = cleanStr(body.email).toLowerCase();
      const role = cleanStr(body.role) || "admin";

      if (!username) return json({ error: "invalid_input", message: "Username is required." }, 400);
      if (!EMAIL_PATTERN.test(email)) return json({ error: "invalid_input", message: "A valid email is required." }, 400);
      if (!ALLOWED_ROLES.has(role)) return json({ error: "invalid_input", message: "Invalid role." }, 400);

      const { data: existing } = await admin
        .from("admin_users")
        .select("id")
        .ilike("email", email)
        .maybeSingle();
      if (existing) {
        return json({ error: "email_exists", message: "An admin with this email already exists." }, 409);
      }

      // Provision the passwordless auth user (ignore "already registered").
      let authUserId: string | null = null;
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
      });
      if (createErr && !/already|exists|registered/i.test(createErr.message)) {
        throw createErr;
      }
      authUserId = created?.user?.id ?? null;

      // Upsert admin_users (handles the legacy auto-create trigger racing on insert).
      const { data: inserted, error: insertErr } = await admin
        .from("admin_users")
        .upsert(
          {
            email,
            username,
            full_name: username,
            role,
            is_active: true,
            user_id: authUserId,
          },
          { onConflict: "email" }
        )
        .select(PUBLIC_COLUMNS)
        .single();
      if (insertErr) throw insertErr;

      return json({ success: true, user: inserted });
    }

    // 4. UPDATE ---------------------------------------------------------------
    if (action === "update") {
      const id = cleanStr(body.id);
      if (!id) return json({ error: "invalid_input", message: "Missing user id." }, 400);

      const { data: target, error: targetErr } = await admin
        .from("admin_users")
        .select("id, email, role, user_id")
        .eq("id", id)
        .maybeSingle();
      if (targetErr) throw targetErr;
      if (!target) return json({ error: "not_found", message: "User not found." }, 404);

      const username = cleanStr(body.username);
      const email = cleanStr(body.email).toLowerCase();
      const role = cleanStr(body.role);

      if (!username) return json({ error: "invalid_input", message: "Username is required." }, 400);
      if (!EMAIL_PATTERN.test(email)) return json({ error: "invalid_input", message: "A valid email is required." }, 400);
      if (!ALLOWED_ROLES.has(role)) return json({ error: "invalid_input", message: "Invalid role." }, 400);

      // Prevent a super admin from demoting themselves (avoids self lock-out).
      if (target.id === caller.id && role !== "super_admin") {
        return json({ error: "self_demote", message: "You can't change your own super-admin role." }, 400);
      }

      // Guard the last remaining super admin.
      if (target.role === "super_admin" && role !== "super_admin") {
        const { count } = await admin
          .from("admin_users")
          .select("id", { count: "exact", head: true })
          .eq("role", "super_admin")
          .eq("is_active", true);
        if ((count ?? 0) <= 1) {
          return json({ error: "last_super_admin", message: "At least one super admin must remain." }, 400);
        }
      }

      // If the email changed, ensure it isn't taken and sync the auth user.
      const emailChanged = email !== target.email.toLowerCase();
      if (emailChanged) {
        const { data: clash } = await admin
          .from("admin_users")
          .select("id")
          .ilike("email", email)
          .neq("id", id)
          .maybeSingle();
        if (clash) return json({ error: "email_exists", message: "An admin with this email already exists." }, 409);

        if (target.user_id) {
          const { error: authUpdErr } = await admin.auth.admin.updateUserById(target.user_id, {
            email,
            email_confirm: true,
          });
          if (authUpdErr) throw authUpdErr;
        }
      }

      const { data: updated, error: updateErr } = await admin
        .from("admin_users")
        .update({ username, full_name: username, email, role })
        .eq("id", id)
        .select(PUBLIC_COLUMNS)
        .single();
      if (updateErr) throw updateErr;

      return json({ success: true, user: updated });
    }

    // 5. DELETE ---------------------------------------------------------------
    if (action === "delete") {
      const id = cleanStr(body.id);
      if (!id) return json({ error: "invalid_input", message: "Missing user id." }, 400);

      const { data: target, error: targetErr } = await admin
        .from("admin_users")
        .select("id, role, user_id")
        .eq("id", id)
        .maybeSingle();
      if (targetErr) throw targetErr;
      if (!target) return json({ error: "not_found", message: "User not found." }, 404);

      if (target.id === caller.id) {
        return json({ error: "self_delete", message: "You can't delete your own account." }, 400);
      }

      if (target.role === "super_admin") {
        const { count } = await admin
          .from("admin_users")
          .select("id", { count: "exact", head: true })
          .eq("role", "super_admin")
          .eq("is_active", true);
        if ((count ?? 0) <= 1) {
          return json({ error: "last_super_admin", message: "At least one super admin must remain." }, 400);
        }
      }

      const { error: delErr } = await admin.from("admin_users").delete().eq("id", id);
      if (delErr) throw delErr;

      // Remove the backing auth user too (best-effort — row is already gone).
      if (target.user_id) {
        const { error: authDelErr } = await admin.auth.admin.deleteUser(target.user_id);
        if (authDelErr) console.log("[admin-manage-users] auth delete warning:", authDelErr.message);
      }

      return json({ success: true });
    }

    return json({ error: "unknown_action", message: "Unknown action." }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log("[admin-manage-users] error:", message);
    return json({ error: "server_error", message: "Something went wrong. Please try again." }, 500);
  }
});
