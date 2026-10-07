import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
const SIGNICAT_BASE = Deno.env.get("SIGNICAT_BASE_URL");
const ACCOUNT_ID = Deno.env.get("SIGNICAT_ACCOUNT_ID");
const SIGNICAT_API_KEY = Deno.env.get("SIGNICAT_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
serve(async (req)=>{
   if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    const { id, sessionNonce, customer_id } = await req.json(); // session id + nonce and your customer_id
    if (!id || !sessionNonce) return new Response("Missing id or sessionNonce", {
      status: 400
    });
    const res = await fetch(`${SIGNICAT_BASE}/auth/rest/sessions/${id}?sessionNonce=${encodeURIComponent(sessionNonce)}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${SIGNICAT_API_KEY}`,
        "Accept": "application/json"
      }
    });
    if (!res.ok) {
      const t = await res.text();
      return new Response(t, {
        status: res.status
      });
    }
    const session = await res.json();
    if (session.status !== "SUCCESS") {
      return new Response(JSON.stringify({
        status: session.status
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    const subject = session.subject || {};
    // Map fields
    const nin = subject.nin?.value ?? null;
    const name = subject.name ?? `${subject.firstName ?? ""} ${subject.lastName ?? ""}`.trim();
    const birth = subject.dateOfBirth ?? null;
    const subjectId = subject.id ?? null;
    // store verification record
    await supabase.from("bankid_verifications").insert([
      {
        customer_id,
        provider: "signicat",
        subject_id: subjectId,
        nin,
        name,
        birth_date: birth,
        session_id: id,
        nbid_sid: subject.nbidSid ?? null,
        raw: session
      }
    ]);
    // update customer verified flag
    await supabase.from("customers").update({
      verified_bankid: true,
      bankid_verified_at: new Date()
    }).eq("id", customer_id);
    return new Response(JSON.stringify({
      success: true,
      subject
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({
      error: String(err)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
