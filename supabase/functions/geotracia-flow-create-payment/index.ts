import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const env = (name: string) => (Deno.env.get(name) ?? "").trim();
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
type Obj = Record<string, unknown>;
function json(body: Obj, status = 200) {
  return new Response(JSON.stringify(body), { status, headers });
}
function safeError(stage: string, error: unknown) {
  const e = error as { code?: string; message?: string; details?: string; hint?: string };
  console.error("geotracia-flow-create-payment", {
    stage, code: e?.code ?? null, message: e?.message ?? String(error ?? "unknown"),
    details: e?.details ?? null, hint: e?.hint ?? null,
  });
}
async function flowSign(params: Record<string, string>, secret: string) {
  const canonical = Object.keys(params).sort().map((key) => key + params[key]).join("");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { status: 200, headers });
  if (req.method !== "POST") return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);
  let stage = "configuration";
  try {
    const projectUrl = env("PROJECT_URL").replace(/\/+$/, "");
    const serviceKey = env("PROJECT_SERVICE_ROLE_KEY");
    const apiKey = env("FLOW_API_KEY");
    const secret = env("FLOW_SECRET_KEY");
    const apiUrl = env("FLOW_API_URL").replace(/\/+$/, "");
    const confirmationUrl = env("FLOW_CONFIRMATION_URL");
    const returnUrl = env("FLOW_RETURN_URL");
    if (![projectUrl, serviceKey, apiKey, secret, apiUrl, confirmationUrl, returnUrl].every(Boolean))
      return json({ ok: false, error: "FLOW_CONFIG_MISSING", stage }, 500);
    if (apiUrl !== "https://www.flow.cl/api")
      return json({ ok: false, error: "FLOW_API_URL_NOT_ALLOWED", stage }, 500);

    stage = "authentication";
    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ ok: false, error: "AUTHORIZATION_REQUIRED", stage }, 401);
    const db = createClient(projectUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await db.auth.getUser(authorization.slice(7).trim());
    if (authError || !auth.user) {
      safeError(stage, authError ?? "USER_NOT_FOUND");
      return json({ ok: false, error: "INVALID_AUTHENTICATION", stage }, 401);
    }
    const user = auth.user;
    if (!user.email) return json({ ok: false, error: "USER_EMAIL_REQUIRED", stage }, 400);

    stage = "request_validation";
    const body = await req.json().catch(() => null) as Obj | null;
    const organizationId = String(body?.organization_id ?? "").trim();
    const planId = String(body?.plan_id ?? "").trim();
    const cycle = String(body?.billing_cycle ?? "").trim();
    if (!organizationId || !planId || !["monthly", "annual"].includes(cycle))
      return json({ ok: false, error: "INVALID_REQUEST", stage }, 400);

    stage = "organization_membership";
    const { data: memberships, error: membershipError } = await db.from("members")
      .select("organization_id,role,active")
      .eq("organization_id", organizationId).eq("user_id", user.id).eq("active", true).limit(1);
    if (membershipError) {
      safeError(stage, membershipError);
      return json({ ok: false, error: "MEMBERSHIP_QUERY_FAILED", stage, db_code: membershipError.code ?? null }, 500);
    }
    const membership = memberships?.[0];
    if (!membership || !["owner", "admin"].includes(String(membership.role ?? "").toLowerCase()))
      return json({ ok: false, error: "ORGANIZATION_ACCESS_DENIED", stage }, 403);

    stage = "plan_lookup";
    // La migración de Geotracia define id TEXT, active y custom_limits.
    const { data: plan, error: planError } = await db.from("geotracia_subscription_plans")
      .select("id,name,monthly_price_clp,annual_price_clp,max_operators,custom_limits,features,active")
      .eq("id", planId).maybeSingle();
    if (planError) {
      safeError(stage, planError);
      return json({ ok: false, error: "PLAN_QUERY_FAILED", stage, db_code: planError.code ?? null }, 500);
    }
    if (!plan) return json({ ok: false, error: "PLAN_NOT_FOUND", stage }, 404);
    if (plan.active !== true) return json({ ok: false, error: "PLAN_INACTIVE", stage }, 400);
    if (plan.custom_limits === true || String(plan.id).toLowerCase() === "institucional")
      return json({ ok: false, error: "PLAN_REQUIRES_COMMERCIAL_PROPOSAL", stage }, 400);

    stage = "price_validation";
    const base = Number(cycle === "annual" ? plan.annual_price_clp : plan.monthly_price_clp);
    // La interfaz publica los precios como “+ IVA”; Flow recibe el total a cobrar.
    const amount = Math.round(base * 1.19);
    if (!Number.isSafeInteger(base) || base <= 0 || !Number.isSafeInteger(amount) || amount <= 0)
      return json({ ok: false, error: "INVALID_PLAN_PRICE", stage, plan_id: planId, billing_cycle: cycle }, 400);

    stage = "payment_insert";
    const { data: payment, error: insertError } = await db.from("geotracia_payments").insert({
      organization_id: organizationId, user_id: user.id, plan_id: planId,
      billing_cycle: cycle, base_amount_clp: base, amount_clp: amount,
      currency: "CLP", status: "pending", provider: "flow",
    }).select("id").single();
    if (insertError || !payment) {
      safeError(stage, insertError ?? "PAYMENT_ROW_NOT_RETURNED");
      return json({ ok: false, error: "PAYMENT_INSERT_FAILED", stage, db_code: insertError?.code ?? null }, 500);
    }

    stage = "flow_create";
    const order = `GEO-${payment.id}`;
    const params: Record<string, string> = {
      apiKey, commerceOrder: order,
      subject: `Geotracia - Plan ${String(plan.name)} (${cycle === "annual" ? "Anual" : "Mensual"})`,
      amount: String(amount), email: user.email,
      urlConfirmation: confirmationUrl, urlReturn: returnUrl, currency: "CLP",
    };
    const signature = await flowSign(params, secret);
    const form = new URLSearchParams({ ...params, s: signature });
    let flowResponse: Response;
    try {
      flowResponse = await fetch(`${apiUrl}/payment/create`, {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(), signal: AbortSignal.timeout(20000),
      });
    } catch (error) {
      safeError(stage, error);
      return json({ ok: false, error: "FLOW_REQUEST_FAILED", stage, payment_id: payment.id }, 502);
    }
    const raw = await flowResponse.text();
    let flowData: Obj;
    try { flowData = JSON.parse(raw) as Obj; }
    catch {
      console.error("geotracia-flow-create-payment", { stage, amount_clp: amount, http_status: flowResponse.status, response_format: "non_json" });
      return json({ ok: false, error: "FLOW_INVALID_RESPONSE", stage, http_status: flowResponse.status }, 502);
    }
    if (!flowResponse.ok) {
      // El código 109 requiere ver el mensaje de Flow y el importe exacto enviado.
      const flowCode = flowData.code ?? flowData.errorCode ?? null;
      const flowMessage = flowData.message ?? flowData.error ?? flowData.errorMsg ?? null;
      console.error("geotracia-flow-create-payment", {
        stage, flow_http_status: flowResponse.status, flow_code: flowCode,
        flow_message: flowMessage, amount_clp: amount, billing_cycle: cycle, plan_id: planId,
      });
      return json({ ok: false, error: "FLOW_CREATE_PAYMENT_ERROR", stage,
        flow_http_status: flowResponse.status, flow_code: flowCode,
        flow_message: flowMessage, amount_clp: amount }, 502);
    }

    const token = String(flowData.token ?? "");
    const checkoutUrl = String(flowData.url ?? "");
    if (!token || !checkoutUrl) return json({ ok: false, error: "FLOW_CHECKOUT_DATA_MISSING", stage }, 502);
    let checkout: URL;
    try { checkout = new URL(checkoutUrl); }
    catch { return json({ ok: false, error: "FLOW_CHECKOUT_URL_INVALID", stage }, 502); }
    // Flow entrega la URL de checkout en la respuesta; acepta solo HTTPS en el dominio oficial.
    if (checkout.protocol !== "https:" || !(checkout.hostname === "flow.cl" || checkout.hostname.endsWith(".flow.cl")))
      return json({ ok: false, error: "FLOW_CHECKOUT_HOST_INVALID", stage }, 502);
    checkout.searchParams.set("token", token);

    stage = "payment_update";
    const { error: updateError } = await db.from("geotracia_payments").update({
      provider_order_id: order, provider_token: token, checkout_url: checkout.toString(),
      provider_payload: flowData, updated_at: new Date().toISOString(),
    }).eq("id", payment.id);
    if (updateError) {
      safeError(stage, updateError);
      return json({ ok: false, error: "PAYMENT_UPDATE_FAILED", stage, db_code: updateError.code ?? null }, 500);
    }
    return json({ ok: true, payment_id: payment.id, checkout_url: checkout.toString(), amount_clp: amount, currency: "CLP" });
  } catch (error) {
    safeError(stage, error);
    return json({ ok: false, error: "INTERNAL_ERROR", stage }, 500);
  }
});
