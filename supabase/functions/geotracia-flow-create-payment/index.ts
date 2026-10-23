import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = (key: string) => (Deno.env.get(key) || "").trim();
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors });
}
function logFailure(stage: string, error: unknown) {
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  // Never log API keys, authorization headers, or payment tokens.
  console.error("geotracia-flow-create-payment", {
    stage,
    code: e?.code || null,
    message: e?.message || String(error || "unknown"),
    details: e?.details || null,
    hint: e?.hint || null,
  });
}
async function sign(params: Record<string, string>, secret: string) {
  const canonical = Object.keys(params).sort().map((key) => key + params[key]).join("");
  const cryptoKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return response({ ok: true });
  if (req.method !== "POST") return response({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  let stage = "configuration";
  try {
    const projectUrl = env("PROJECT_URL").replace(/\/+$/, "");
    const serviceKey = env("PROJECT_SERVICE_ROLE_KEY");
    const flowApiKey = env("FLOW_API_KEY");
    const flowSecret = env("FLOW_SECRET_KEY");
    const flowApiUrl = env("FLOW_API_URL").replace(/\/+$/, "");
    const confirmationUrl = env("FLOW_CONFIRMATION_URL");
    const returnUrl = env("FLOW_RETURN_URL");

    if (!projectUrl || !serviceKey || !flowApiKey || !flowSecret || !flowApiUrl || !confirmationUrl || !returnUrl) {
      return response({ ok: false, error: "FLOW_CONFIG_MISSING", stage }, 500);
    }
    if (flowApiUrl !== "https://www.flow.cl/api") {
      return response({ ok: false, error: "FLOW_API_URL_NOT_ALLOWED", stage }, 500);
    }

    stage = "authentication";
    const authorization = req.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) return response({ ok: false, error: "AUTHORIZATION_REQUIRED", stage }, 401);
    const jwt = authorization.slice(7).trim();
    const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await db.auth.getUser(jwt);
    if (authError || !authData.user) {
      logFailure(stage, authError || "USER_NOT_FOUND");
      return response({ ok: false, error: "INVALID_AUTHENTICATION", stage }, 401);
    }
    const user = authData.user;
    if (!user.email) return response({ ok: false, error: "USER_EMAIL_REQUIRED", stage }, 400);

    stage = "request_validation";
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    const organizationId = String(body?.organization_id || "").trim();
    const planId = String(body?.plan_id || "").trim();
    const billingCycle = String(body?.billing_cycle || "").trim();
    if (!organizationId || !planId || !["monthly", "annual"].includes(billingCycle)) {
      return response({ ok: false, error: "INVALID_REQUEST", stage, received: {
        organization_id: Boolean(organizationId), plan_id: Boolean(planId),
        billing_cycle: billingCycle || null,
      } }, 400);
    }

    stage = "organization_membership";
    // Matches the membership query used by Geotracia's app.js.
    const { data: members, error: memberError } = await db
      .from("members")
      .select("organization_id,role,active")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("active", true)
      .limit(1);
    if (memberError) {
      logFailure(stage, memberError);
      return response({ ok: false, error: "MEMBERSHIP_QUERY_FAILED", stage, db_code: memberError.code || null }, 500);
    }
    const member = members?.[0];
    if (!member || !["owner", "admin"].includes(String(member.role || "").toLowerCase())) {
      return response({ ok: false, error: "ORGANIZATION_ACCESS_DENIED", stage }, 403);
    }

    stage = "plan_lookup";
    // IDs in Geotracia's subscription schema are TEXT (e.g. individual/equipo/empresa).
    const { data: plan, error: planError } = await db
      .from("geotracia_subscription_plans")
      .select("id,name,monthly_price_clp,annual_price_clp,max_operators,custom_limits,features,active")
      .eq("id", planId)
      .maybeSingle();
    if (planError) {
      logFailure(stage, planError);
      return response({ ok: false, error: "PLAN_QUERY_FAILED", stage, db_code: planError.code || null }, 500);
    }
    if (!plan) return response({ ok: false, error: "PLAN_NOT_FOUND", stage, plan_id: planId }, 400);
    if (plan.active !== true) return response({ ok: false, error: "PLAN_INACTIVE", stage, plan_id: planId }, 400);
    if (plan.custom_limits === true || String(plan.id).toLowerCase() === "institucional") {
      return response({ ok: false, error: "PLAN_REQUIRES_COMMERCIAL_PROPOSAL", stage }, 400);
    }

    stage = "price_validation";
    const base = Number(billingCycle === "annual" ? plan.annual_price_clp : plan.monthly_price_clp);
    // UI prices are marked '+ IVA', so the charged amount includes Chilean VAT (19%).
    const amount = Math.round(base * 1.19);
    if (!Number.isSafeInteger(base) || base <= 0 || !Number.isSafeInteger(amount) || amount <= 0) {
      return response({ ok: false, error: "INVALID_PLAN_PRICE", stage, plan_id: planId, billing_cycle: billingCycle }, 400);
    }

    stage = "payment_insert";
    const { data: payment, error: insertError } = await db
      .from("geotracia_payments")
      .insert({
        organization_id: organizationId,
        user_id: user.id,
        plan_id: planId,
        billing_cycle: billingCycle,
        base_amount_clp: base,
        amount_clp: amount,
        currency: "CLP",
        status: "pending",
        provider: "flow",
      })
      .select("id")
      .single();
    if (insertError || !payment) {
      logFailure(stage, insertError || "PAYMENT_ROW_NOT_RETURNED");
      return response({ ok: false, error: "PAYMENT_INSERT_FAILED", stage, db_code: insertError?.code || null }, 500);
    }

    stage = "flow_create";
    const order = `GEO-${payment.id}`;
    const params: Record<string, string> = {
      apiKey: flowApiKey,
      commerceOrder: order,
      subject: `Geotracia - Plan ${plan.name} (${billingCycle === "annual" ? "Anual" : "Mensual"})`,
      amount: String(amount),
      email: user.email,
      urlConfirmation: confirmationUrl,
      urlReturn: returnUrl,
      currency: "CLP",
    };
    const signature = await sign(params, flowSecret);
    const form = new URLSearchParams({ ...params, s: signature });
    let flowResponse: Response;
    try {
      flowResponse = await fetch(`${flowApiUrl}/payment/create`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
        signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      logFailure(stage, error);
      return response({ ok: false, error: "FLOW_REQUEST_FAILED", stage, payment_id: payment.id }, 502);
    }
    const raw = await flowResponse.text();
    let flowData: Record<string, unknown>;
    try { flowData = JSON.parse(raw); } catch {
      console.error("geotracia-flow-create-payment", { stage, message: "FLOW_RESPONSE_NOT_JSON", http_status: flowResponse.status });
      return response({ ok: false, error: "FLOW_INVALID_RESPONSE", stage, http_status: flowResponse.status }, 502);
    }
    if (!flowResponse.ok) {
      // Return Flow's code only; never expose raw response or credentials.
      console.error("geotracia-flow-create-payment", { stage, flow_http_status: flowResponse.status, flow_code: flowData.code ?? null });
      return response({ ok: false, error: "FLOW_CREATE_PAYMENT_ERROR", stage, flow_http_status: flowResponse.status, flow_code: flowData.code ?? null }, 502);
    }

    const token = String(flowData.token || "");
    const checkoutUrl = String(flowData.url || "");
    if (!token || !checkoutUrl) return response({ ok: false, error: "FLOW_CHECKOUT_DATA_MISSING", stage }, 502);
    let parsedCheckout: URL;
    try { parsedCheckout = new URL(checkoutUrl); } catch {
      return response({ ok: false, error: "FLOW_CHECKOUT_URL_INVALID", stage }, 502);
    }
    if (parsedCheckout.protocol !== "https:" || parsedCheckout.hostname !== "www.flow.cl") {
      return response({ ok: false, error: "FLOW_CHECKOUT_HOST_INVALID", stage }, 502);
    }
    parsedCheckout.searchParams.set("token", token);

    stage = "payment_update";
    const { error: updateError } = await db.from("geotracia_payments").update({
      provider_order_id: order,
      provider_token: token,
      checkout_url: parsedCheckout.toString(),
      provider_payload: flowData,
      updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (updateError) {
      logFailure(stage, updateError);
      return response({ ok: false, error: "PAYMENT_UPDATE_FAILED", stage, db_code: updateError.code || null }, 500);
    }

    return response({ ok: true, payment_id: payment.id, checkout_url: parsedCheckout.toString(), amount_clp: amount, currency: "CLP" });
  } catch (error) {
    logFailure(stage, error);
    return response({ ok: false, error: "INTERNAL_ERROR", stage }, 500);
  }
});
