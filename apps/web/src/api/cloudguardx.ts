import type { AssetSummary, FindingStatus, FindingSummary } from "@cloudguardx/shared-types";
import type { CloudAccountSummary, FindingFilters } from "../types";

export interface CloudGuardApiClientOptions {
  accessToken?: string | null;
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export class CloudGuardApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly responseBody: string
  ) {
    super(message);
    this.name = "CloudGuardApiError";
  }
}

export class CloudGuardApiClient {
  private readonly accessToken: string | null;
  private readonly baseUrl: string;
  private readonly fetcher: typeof fetch;

  constructor(options: CloudGuardApiClientOptions = {}) {
    this.accessToken = options.accessToken?.trim() || null;
    this.baseUrl = normalizeBaseUrl(options.baseUrl ?? import.meta.env.VITE_API_BASE_URL ?? "/api");
    this.fetcher = options.fetcher ?? fetch;
  }

  listCloudAccounts(): Promise<CloudAccountSummary[]> {
    return this.request<CloudAccountSummary[]>("/cloud-accounts");
  }

  listAssets(): Promise<AssetSummary[]> {
    return this.request<AssetSummary[]>("/assets");
  }

  listFindings(filters: FindingFilters = {}): Promise<FindingSummary[]> {
    const params = new URLSearchParams();

    if (filters.severity) {
      params.set("severity", filters.severity);
    }

    if (filters.status) {
      params.set("status", filters.status);
    }

    const query = params.toString();

    return this.request<FindingSummary[]>(`/findings${query ? `?${query}` : ""}`);
  }

  getFinding(findingId: string): Promise<FindingSummary> {
    return this.request<FindingSummary>(`/findings/${encodeURIComponent(findingId)}`);
  }

  updateFindingStatus(findingId: string, status: FindingStatus): Promise<FindingSummary> {
    return this.request<FindingSummary>(`/findings/${encodeURIComponent(findingId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status })
    });
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);

    headers.set("Accept", "application/json");

    if (init.body) {
      headers.set("Content-Type", "application/json");
    }

    if (this.accessToken) {
      headers.set("Authorization", `Bearer ${this.accessToken}`);
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      ...init,
      headers
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new CloudGuardApiError(apiErrorMessage(response.status), response.status, responseBody);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }
}

export function accessTokenFromStorage(storage: Storage = window.localStorage): string | null {
  return storage.getItem("cloudguardx.accessToken");
}

export function createCloudGuardApiClient(options: CloudGuardApiClientOptions = {}): CloudGuardApiClient {
  return new CloudGuardApiClient(options);
}

function normalizeBaseUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "/api";
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function apiErrorMessage(status: number): string {
  if (status === 401) {
    return "API access token was rejected";
  }

  if (status === 403) {
    return "You do not have permission for this action";
  }

  if (status === 404) {
    return "The requested record was not found";
  }

  return "CloudGuardX API request failed";
}
