export class ApiError extends Error {
  status: number;
  issues: string[];

  constructor(message: string, status: number, issues: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const data = (await response.json().catch(() => null)) as
    | (T & { error?: string; issues?: string[] })
    | null;
  if (!response.ok) {
    throw new ApiError(data?.error || "Er ging iets mis.", response.status, data?.issues ?? []);
  }
  return data as T;
}
