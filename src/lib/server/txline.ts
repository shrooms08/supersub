// Server-side TxLINE client. Tokens come from env vars (the spike's token
// approach; there is no in-app subscribe flow in this phase):
//   TXLINE_NETWORK   devnet | mainnet (default devnet)
//   TXLINE_JWT       guest JWT from POST /auth/guest/start
//   TXLINE_API_TOKEN activated api token from the on-chain subscription
// The JWT is renewable without the wallet (guest/start is unauthenticated),
// so a 401 triggers an in-memory renewal and one retry. The API token
// cannot be renewed here; if it is missing or expired, LIVE mode fails
// with a clear error while REPLAY mode keeps working from bundled data.

const HOSTS: Record<string, string> = {
  devnet: "https://txline-dev.txodds.com",
  mainnet: "https://txline.txodds.com",
};

function host(): string {
  const network = process.env.TXLINE_NETWORK ?? "devnet";
  const h = HOSTS[network];
  if (!h) throw new Error(`TXLINE_NETWORK must be devnet or mainnet, got ${network}`);
  return h;
}

// In-memory JWT that starts from the env var and refreshes on 401.
let currentJwt: string | undefined;

function apiToken(): string {
  const t = process.env.TXLINE_API_TOKEN;
  if (!t) {
    throw new Error(
      "TXLINE_API_TOKEN is not set. LIVE mode and on-demand replay fetching need it; bundled REPLAY fixtures do not."
    );
  }
  return t;
}

async function renewJwt(): Promise<string> {
  const res = await fetch(`${host()}/auth/guest/start`, { method: "POST", cache: "no-store" });
  if (!res.ok) throw new Error(`guest/start failed: HTTP ${res.status}`);
  const body = (await res.json()) as { token: string };
  currentJwt = body.token;
  return currentJwt;
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${currentJwt ?? process.env.TXLINE_JWT ?? ""}`,
    "X-Api-Token": apiToken(),
  };
}

// GET returning raw text, with one JWT renewal on 401 and two retries on
// transient network errors (both observed in the spike).
export async function txGetText(pathname: string): Promise<string> {
  const url = `${host()}/api${pathname}`;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      let res = await fetch(url, { headers: headers(), cache: "no-store" });
      if (res.status === 401) {
        await renewJwt();
        res = await fetch(url, { headers: headers(), cache: "no-store" });
      }
      if (!res.ok) throw new Error(`GET ${pathname}: HTTP ${res.status} ${await res.text()}`);
      return await res.text();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("fetch failed") || attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw lastErr;
}

export async function txGetJson<T>(pathname: string): Promise<T> {
  const text = await txGetText(pathname);
  return JSON.parse(text) as T;
}

// Open an upstream SSE stream and invoke onData for every data message.
// Resolves when the signal aborts or the server closes the stream.
export async function txStream(
  pathname: string,
  signal: AbortSignal,
  onData: (data: string) => void,
  onHeartbeat?: () => void
): Promise<void> {
  const url = `${host()}/api${pathname}`;
  let res = await fetch(url, {
    headers: { ...headers(), Accept: "text/event-stream" },
    signal,
    cache: "no-store",
  });
  if (res.status === 401) {
    await renewJwt();
    res = await fetch(url, {
      headers: { ...headers(), Accept: "text/event-stream" },
      signal,
      cache: "no-store",
    });
  }
  if (!res.ok || !res.body) throw new Error(`SSE ${pathname}: HTTP ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let eventName = "";
  let dataLines: string[] = [];

  const dispatch = () => {
    if (dataLines.length === 0) return;
    const data = dataLines.join("\n");
    if (eventName === "heartbeat") onHeartbeat?.();
    else onData(data);
    eventName = "";
    dataLines = [];
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, "");
        buffer = buffer.slice(nl + 1);
        if (line === "") dispatch();
        else if (line.startsWith("event:")) eventName = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
    }
  } catch (err) {
    if (!signal.aborted) throw err;
  }
}

// Helpers for the 5-minute interval historical endpoints.
export function epochDay(tsMs: number): number {
  return Math.floor(tsMs / 86_400_000);
}
export function hourOfDay(tsMs: number): number {
  return Math.floor((tsMs % 86_400_000) / 3_600_000);
}
export function fiveMinInterval(tsMs: number): number {
  return Math.floor((tsMs % 3_600_000) / 300_000);
}
// Start timestamps of every FULLY SEALED 5-minute interval covering
// [fromMs, toMs). An interval is sealed once its end is in the past;
// the current interval is still being written and is excluded.
export function sealedIntervalStarts(fromMs: number, toMs: number, nowMs: number): number[] {
  const out: number[] = [];
  const first = Math.floor(fromMs / 300_000) * 300_000;
  for (let t = first; t < toMs; t += 300_000) {
    if (t + 300_000 <= nowMs) out.push(t);
  }
  return out;
}
