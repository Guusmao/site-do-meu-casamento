// supabase/functions/_shared/qrToken.ts
// Gera e valida um token assinado (HMAC-SHA256) para o QR Code.
// Ninguém consegue forjar um QR válido sem conhecer o QR_SECRET,
// que só existe no servidor (Edge Function), nunca no site.

function base64url(input: Uint8Array): string {
  return btoa(String.fromCharCode(...input))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64urlToBytes(str: string): Uint8Array {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  return new Uint8Array([...bin].map((c) => c.charCodeAt(0)));
}

async function hmac(secret: string, data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

export async function assinarToken(payload: object, secret: string): Promise<string> {
  const json = JSON.stringify(payload);
  const payloadB64 = base64url(new TextEncoder().encode(json));
  const sig = await hmac(secret, payloadB64);
  const sigB64 = base64url(sig);
  return `${payloadB64}.${sigB64}`;
}

export async function verificarToken(
  token: string,
  secret: string
): Promise<{ valido: boolean; payload?: any }> {
  const partes = token.split(".");
  if (partes.length !== 2) return { valido: false };
  const [payloadB64, sigB64] = partes;

  const sigEsperada = await hmac(secret, payloadB64);
  const sigEsperadaB64 = base64url(sigEsperada);

  // Comparação em tempo constante
  if (sigEsperadaB64.length !== sigB64.length) return { valido: false };
  let diff = 0;
  for (let i = 0; i < sigEsperadaB64.length; i++) {
    diff |= sigEsperadaB64.charCodeAt(i) ^ sigB64.charCodeAt(i);
  }
  if (diff !== 0) return { valido: false };

  try {
    const json = new TextDecoder().decode(base64urlToBytes(payloadB64));
    return { valido: true, payload: JSON.parse(json) };
  } catch {
    return { valido: false };
  }
}
