import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async () => {
  const key = Deno.env.get("LOVABLE_API_KEY")!;
  const res = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
    method: "POST",
    headers: { "Lovable-API-Key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "openai/gpt-image-2",
      prompt: "A red apple on a white background, product photo",
      n: 1,
      size: "1024x1024",
      quality: "medium",
    }),
  });
  const text = await res.text();
  const parsed = (() => { try { return JSON.parse(text); } catch { return null; } })();
  const first = parsed?.data?.[0] ?? {};
  return Response.json({
    status: res.status,
    keys: Object.keys(first),
    b64Length: typeof first.b64_json === "string" ? first.b64_json.length : 0,
    urlPrefix: typeof first.url === "string" ? first.url.slice(0, 40) : null,
    error: parsed?.error ?? (res.ok ? null : text.slice(0, 300)),
  });
});
