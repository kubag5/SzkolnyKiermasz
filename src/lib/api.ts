export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly details?: unknown) {
    super(message);
    this.name = "ApiError";
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      credentials: "include",
      headers: { ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError("Brak połączenia z serwerem.", 0, "NETWORK_ERROR");
  }

  if (response.status === 204) return undefined as T;
  const payload = await response.json().catch(() => null) as {
    data?: T;
    error?: { message?: string; code?: string; details?: unknown };
  } | null;
  if (!response.ok) {
    if (response.status >= 500 && !payload?.error) {
      throw new ApiError("Serwer nie odpowiada.", response.status, "SERVER_UNAVAILABLE");
    }
    throw new ApiError(payload?.error?.message ?? "Wystąpił błąd.", response.status, payload?.error?.code, payload?.error?.details);
  }
  return payload?.data as T;
}

export type User = { id: string; username: string; nickname: string };
export type Offer = {
  id: string;
  title: string;
  description: string;
  pricePln: number;
  condition: "NEW" | "VERY_GOOD" | "GOOD" | "ACCEPTABLE";
  status: "AVAILABLE" | "SOLD";
  sellerId: string;
  seller: { id: string; nickname: string };
  createdAt: string;
  updatedAt: string;
};
export type OfferInput = Pick<Offer, "title" | "description" | "pricePln" | "condition">;
export type Currency = { iso_code: string; name: string; symbol?: string | null };
export type Rate = { base: string; quote: string; date: string; rate: number; stale: boolean };
