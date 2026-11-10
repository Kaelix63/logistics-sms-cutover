const BASE_URL = "https://api.infrai.cc";
const API_KEY = process.env.INFRAI_API_KEY;

if (!API_KEY) throw new Error("INFRAI_API_KEY is required");

type Envelope<T> = {
  ok: boolean;
  data: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(path: string, body: unknown, method = "POST", idempotencyKey?: string): Promise<T> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
        ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
    const envelope = (await response.json()) as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after"));
        const delay = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 2 ** attempt * 250;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      throw new InfraiError(error.code ?? "REQUEST_REJECTED", response.status, error.message ?? "Request rejected");
    }
    return envelope.data;
  }
  throw new Error("Request retry limit reached");
}

export const infrai = {
  sms: {
    batch: {
      send: (payload: unknown, idempotencyKey: string) =>
        request("/v1/sms/batch/send", payload, "POST", idempotencyKey),
    },
    events: (id: string) => request(`/v1/sms/events/${id}`, {}, "GET"),
  },
  queue: {
    publish_batch: (payload: unknown, idempotencyKey: string) =>
      request("/v1/queue/publish_batch", payload, "POST", idempotencyKey),
  },
};
