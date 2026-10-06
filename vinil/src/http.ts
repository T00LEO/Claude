export const USER_AGENT = "CacaVinil/1.0 +https://github.com/t00leo/Claude";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class HttpError extends Error {
  status: number;
  constructor(status: number, url: string) {
    super(`HTTP ${status} em ${url.replace(/([?&](token|access_token)=)[^&]+/, "$1***")}`);
    this.status = status;
  }
}

/** GET/POST que tenta de novo uma vez em 429/5xx. */
async function pegar(url: string, init: RequestInit, accept: string): Promise<Response> {
  for (let tentativa = 0; ; tentativa++) {
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, Accept: accept, ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
    if (res.ok) return res;
    if (tentativa === 0 && (res.status === 429 || res.status >= 500)) {
      await sleep(res.status === 429 ? 60_000 : 3_000);
      continue;
    }
    throw new HttpError(res.status, url);
  }
}

export async function pegarJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  return (await (await pegar(url, init, "application/json")).json()) as T;
}

export async function pegarHtml(url: string): Promise<string> {
  return (await pegar(url, {}, "text/html")).text();
}

/** Garante um intervalo mínimo entre chamadas, para respeitar limites de requisição. */
export function limitador(intervaloMs: number) {
  let proxima = 0;
  return async () => {
    const agora = Date.now();
    const espera = proxima - agora;
    proxima = Math.max(agora, proxima) + intervaloMs;
    if (espera > 0) await sleep(espera);
  };
}
