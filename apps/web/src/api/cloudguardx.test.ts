import { afterEach, describe, expect, it, vi } from "vitest";
import { FindingSeverity, FindingStatus } from "@cloudguardx/shared-types";
import { CloudGuardApiClient, CloudGuardApiError } from "./cloudguardx";

describe("CloudGuardApiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends bearer auth and supported finding filters", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse([]));
    const client = new CloudGuardApiClient({
      accessToken: "token-1",
      baseUrl: "https://api.example.test/api/",
      fetcher: fetcher as never
    });

    await client.listFindings({
      severity: FindingSeverity.High,
      status: FindingStatus.Open
    });

    expect(fetcher).toHaveBeenCalledWith(
      "https://api.example.test/api/findings?severity=high&status=open",
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );
    const headers = fetcher.mock.calls[0]?.[1]?.headers as Headers;

    expect(headers.get("Authorization")).toBe("Bearer token-1");
  });

  it("updates finding status through the backend endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ id: "finding-1", status: "triaged" }));
    const client = new CloudGuardApiClient({
      accessToken: "token-1",
      fetcher: fetcher as never
    });

    await client.updateFindingStatus("finding-1", FindingStatus.Triaged);

    expect(fetcher).toHaveBeenCalledWith(
      "/api/findings/finding-1/status",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "triaged" })
      })
    );
  });

  it("raises typed API errors for failed responses", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response("nope", { status: 403 }));
    const client = new CloudGuardApiClient({
      accessToken: "token-1",
      fetcher: fetcher as never
    });

    await expect(client.listAssets()).rejects.toBeInstanceOf(CloudGuardApiError);
  });

  it("binds the default browser fetcher to window", async () => {
    const fetcher = vi.fn(function (this: Window): Promise<Response> {
      expect(this).toBe(window);

      return Promise.resolve(jsonResponse([]));
    });
    vi.stubGlobal("fetch", fetcher);

    const client = new CloudGuardApiClient({ accessToken: "token-1" });

    await client.listAssets();
    expect(fetcher).toHaveBeenCalledWith(
      "/api/assets",
      expect.objectContaining({
        headers: expect.any(Headers)
      })
    );
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: 200
  });
}
