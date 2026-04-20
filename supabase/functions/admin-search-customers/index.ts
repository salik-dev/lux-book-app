// @ts-nocheck
// -----------------------------------------------------------------------------
// admin-search-customers
//
// Returns customers eligible for an admin-initiated booking (BankID verified
// AND contract signed). Admin-only; uses the service role key internally but
// validates the caller is an active admin first.
//
// Tries the view `v_admin_eligible_customers` first (created by the migration);
// falls back to a direct join against customers + bankid_verifications so the
// endpoint still works before the migration is applied.
// -----------------------------------------------------------------------------
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function serializeError(e: unknown): { message: string; details?: unknown } {
  if (e instanceof Error) return { message: e.message };
  if (e && typeof e === "object") {
    const anyE = e as Record<string, unknown>;
    const msg =
      (typeof anyE.message === "string" && anyE.message) ||
      (typeof anyE.msg === "string" && anyE.msg) ||
      (typeof anyE.error === "string" && anyE.error) ||
      "unknown_error";
    return {
      message: String(msg),
      details: {
        code: anyE.code ?? null,
        details: anyE.details ?? null,
        hint: anyE.hint ?? null,
      },
    };
  }
  return { message: String(e) };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;

// PostgREST error code for "missing relation" (view not yet created).
const MISSING_RELATION_CODES = new Set(["42P01", "PGRST205"]);

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "method_not_allowed" }, 405);
  }

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

    // 1. Auth: require an admin user's JWT
    const authHeader = req.headers.get("Authorization") || "";
    const userJwt = authHeader.replace("Bearer ", "").trim();
    if (!userJwt) return json({ error: "unauthorized" }, 401);

    const { data: userData, error: userErr } = await admin.auth.getUser(userJwt);
    if (userErr || !userData?.user) return json({ error: "unauthorized" }, 401);

    const { data: adminUser } = await admin
      .from("admin_users")
      .select("id, is_active")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    let resolvedAdmin = adminUser;
    if (!resolvedAdmin?.is_active && userData.user.email) {
      const { data: adminByEmail } = await admin
        .from("admin_users")
        .select("id, is_active")
        .eq("email", userData.user.email)
        .maybeSingle();
      if (adminByEmail?.is_active) {
        await admin.from("admin_users").update({ user_id: userData.user.id }).eq("id", adminByEmail.id);
        resolvedAdmin = adminByEmail;
      }
    }

    if (!resolvedAdmin?.is_active) return json({ error: "forbidden" }, 403);

    // 2. Parse params
    let q = "";
    let page = 0;
    let pageSize = PAGE_SIZE_DEFAULT;

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      q = typeof body.q === "string" ? body.q.trim() : "";
      page = Number.isFinite(body.page) ? Math.max(0, Number(body.page)) : 0;
      pageSize = Number.isFinite(body.pageSize)
        ? Math.min(PAGE_SIZE_MAX, Math.max(1, Number(body.pageSize)))
        : PAGE_SIZE_DEFAULT;
    } else {
      const u = new URL(req.url);
      q = (u.searchParams.get("q") || "").trim();
      page = Math.max(0, Number(u.searchParams.get("page") || "0"));
      pageSize = Math.min(
        PAGE_SIZE_MAX,
        Math.max(1, Number(u.searchParams.get("pageSize") || PAGE_SIZE_DEFAULT))
      );
    }

    // 3. Query: prefer the migration's view; fall back to a direct join.
    const from = page * pageSize;
    const to = from + pageSize - 1;

    // Strip PostgREST-special chars out of the search term up front.
    const safe = q.replace(/[%,()]/g, " ").trim();

    let items: unknown[] = [];
    let total = 0;
    let usedFallback = false;

    // --- Attempt 1: view ---------------------------------------------------
    let viewQuery = admin
      .from("v_admin_eligible_customers")
      .select(
        "customer_id, full_name, email, phone, city, driver_license_number, nin_last4, verification_id, contract_signed_at, contract_file_path, total_bookings, customer_created_at",
        { count: "exact" }
      )
      .order("contract_signed_at", { ascending: false, nullsFirst: false })
      .range(from, to);

    if (safe) {
      viewQuery = viewQuery.or(
        [
          `full_name.ilike.%${safe}%`,
          `email.ilike.%${safe}%`,
          `phone.ilike.%${safe}%`,
          `driver_license_number.ilike.%${safe}%`,
        ].join(",")
      );
    }

    const viewRes = await viewQuery;

    if (!viewRes.error) {
      items = viewRes.data ?? [];
      total = viewRes.count ?? 0;
    } else if (MISSING_RELATION_CODES.has(String(viewRes.error.code))) {
      // --- Attempt 2: fallback — two queries, no FK embed needed ----------
      usedFallback = true;
      console.log("[admin-search-customers] view missing, using fallback queries");

      // 2a. Collect customer_ids with contract_status = true.
      const { data: bvRows, error: bvErr } = await admin
        .from("bankid_verifications")
        .select("id, customer_id, nin, contract_signed_at, contract_file_path")
        .eq("contract_status", true)
        .not("customer_id", "is", null)
        .order("contract_signed_at", { ascending: false, nullsFirst: false });

      if (bvErr) {
        console.log("[admin-search-customers] bv fallback failed", bvErr);
        return json({ error: "query_failed", ...serializeError(bvErr) }, 500);
      }

      const bvByCustomer = new Map<
        string,
        {
          id: string;
          nin: string | null;
          contract_signed_at: string | null;
          contract_file_path: string | null;
        }
      >();
      for (const row of bvRows ?? []) {
        if (row.customer_id && !bvByCustomer.has(row.customer_id)) {
          bvByCustomer.set(row.customer_id, {
            id: row.id,
            nin: row.nin,
            contract_signed_at: row.contract_signed_at,
            contract_file_path: row.contract_file_path ?? null,
          });
        }
      }

      const eligibleIds = Array.from(bvByCustomer.keys());
      if (eligibleIds.length === 0) {
        items = [];
        total = 0;
      } else {
        const cQuery = admin
          .from("customers")
          .select("id, full_name, email, phone, city, driver_license_number, created_at", {
            count: "exact",
          })
          .in("id", eligibleIds)
          .order("created_at", { ascending: false });

        const cRes = await cQuery;
        if (cRes.error) {
          console.log("[admin-search-customers] customers fallback failed", cRes.error);
          return json({ error: "query_failed", ...serializeError(cRes.error) }, 500);
        }

        const allRows = cRes.data ?? [];
        const searchNeedle = safe.toLowerCase();
        const filteredRows =
          searchNeedle.length === 0
            ? allRows
            : allRows.filter((row) => {
                const bucket = [
                  row.full_name ?? "",
                  row.email ?? "",
                  row.phone ?? "",
                  row.driver_license_number ?? "",
                ]
                  .join(" ")
                  .toLowerCase();
                return bucket.includes(searchNeedle);
              });

        const pageRows = filteredRows.slice(from, to + 1);
        const pageIds = pageRows.map((r) => r.id);

        const bookingCounts = new Map<string, number>();
        if (pageIds.length > 0) {
          const { data: bookingRows, error: bookingErr } = await admin
            .from("bookings")
            .select("customer_id")
            .in("customer_id", pageIds);
          if (bookingErr) {
            console.log("[admin-search-customers] bookings count fallback failed", bookingErr);
            return json({ error: "query_failed", ...serializeError(bookingErr) }, 500);
          }
          for (const row of bookingRows ?? []) {
            const key = row.customer_id as string;
            bookingCounts.set(key, (bookingCounts.get(key) ?? 0) + 1);
          }
        }

        items = pageRows.map((row) => {
          const bv = bvByCustomer.get(row.id);
          return {
            customer_id: row.id,
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            city: row.city,
            driver_license_number: row.driver_license_number,
            nin_last4: bv?.nin ? String(bv.nin).slice(-4) : null,
            verification_id: bv?.id ?? null,
            contract_signed_at: bv?.contract_signed_at ?? null,
            contract_file_path: bv?.contract_file_path ?? null,
            total_bookings: bookingCounts.get(row.id) ?? 0,
            customer_created_at: row.created_at,
          };
        });
        total = filteredRows.length;
      }
    } else {
      console.log("[admin-search-customers] view error", viewRes.error);
      return json({ error: "query_failed", ...serializeError(viewRes.error) }, 500);
    }

    return json({
      items,
      page,
      pageSize,
      total,
      hasMore: total > (page + 1) * pageSize,
      ...(usedFallback ? { _fallback: true } : {}),
    });
  } catch (err) {
    const ser = serializeError(err);
    console.log("[admin-search-customers] fatal", ser);
    return json({ error: ser.message, details: ser.details }, 500);
  }
});
