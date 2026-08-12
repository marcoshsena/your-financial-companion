const PLUGGY_API = "https://api.pluggy.ai";

let cachedKey: { value: string; expiresAt: number } | null = null;

export function pluggyConfigured() {
  return Boolean(process.env["PLUGGY_CLIENT_ID"] && process.env["PLUGGY_CLIENT_SECRET"]);
}

async function getApiKey(): Promise<string> {
  if (cachedKey && cachedKey.expiresAt > Date.now()) return cachedKey.value;

  const clientId = process.env["PLUGGY_CLIENT_ID"];
  const clientSecret = process.env["PLUGGY_CLIENT_SECRET"];
  if (!clientId || !clientSecret) {
    throw new Error("Credenciais do Pluggy não configuradas.");
  }

  const res = await fetch(`${PLUGGY_API}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  if (!res.ok) throw new Error("Não foi possível autenticar no Pluggy.");
  const json = (await res.json()) as { apiKey: string };
  cachedKey = { value: json.apiKey, expiresAt: Date.now() + 90 * 60 * 1000 };
  return json.apiKey;
}

export async function pluggyFetch<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const apiKey = await getApiKey();
  const res = await fetch(`${PLUGGY_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error("Pluggy error", path, res.status, text);
    throw new Error(`Pluggy respondeu ${res.status}.`);
  }
  return (await res.json()) as T;
}