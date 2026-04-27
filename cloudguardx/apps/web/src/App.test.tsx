import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

const assets = [
  {
    id: "asset-1",
    tenantId: "tenant-1",
    cloudAccountId: "account-1",
    provider: "aws",
    resourceType: "aws_s3_bucket",
    externalId: "arn:aws:s3:::public-bucket",
    arn: "arn:aws:s3:::public-bucket",
    region: "us-east-1",
    name: "public-bucket",
    tags: { Environment: "test" },
    sensitivity: 6,
    criticality: 5,
    firstSeenAt: "2026-04-26T00:00:00.000Z",
    lastSeenAt: "2026-04-26T00:00:00.000Z",
    deletedAt: null
  }
];

const findings = [
  {
    id: "finding-1",
    tenantId: "tenant-1",
    cloudAccountId: "account-1",
    assetId: "asset-1",
    policyId: "policy-1",
    title: "S3 bucket allows public access",
    description: "Bucket policy allows public reads.",
    severity: "high",
    status: "open",
    score: 78,
    evidence: {
      policyAllowsPublicRead: true
    },
    riskScore: {
      factors: {
        internetExposure: 9,
        exploitability: 6
      },
      calculatedAt: "2026-04-26T00:00:00.000Z"
    },
    firstSeenAt: "2026-04-26T00:00:00.000Z",
    lastSeenAt: "2026-04-26T00:00:00.000Z",
    resolvedAt: null,
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z"
  }
];

const cloudAccounts = [
  {
    id: "account-1",
    tenantId: "tenant-1",
    provider: "aws",
    name: "Production",
    externalAccountId: "123456789012",
    status: "active",
    lastSuccessfulScanAt: "2026-04-26T00:00:00.000Z",
    lastScanError: null,
    createdAt: "2026-04-26T00:00:00.000Z",
    updatedAt: "2026-04-26T00:00:00.000Z"
  }
];

describe("App", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("cloudguardx.accessToken", "test-token");
    window.location.hash = "#/overview";
    vi.stubGlobal("fetch", vi.fn(mockFetch));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
    window.localStorage.clear();
  });

  it("renders dashboard metrics from API data", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(await screen.findByText("Cloud accounts")).toBeInTheDocument();
    expect(screen.getAllByText("Assets").length).toBeGreaterThan(0);
    expect(screen.getByText("Open findings")).toBeInTheDocument();
    expect(screen.getAllByText("S3 bucket allows public access").length).toBeGreaterThan(0);
  });

  it("lists assets from the tenant-scoped assets endpoint", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Assets" }));

    expect(await screen.findByRole("heading", { name: "Assets", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("public-bucket")).toBeInTheDocument();
    expect(screen.getByText("AWS S3 Bucket")).toBeInTheDocument();
  });

  it("filters findings by severity and status using supported query params", async () => {
    const fetchSpy = vi.mocked(fetch);

    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Findings" }));
    fireEvent.change(await screen.findByLabelText("Severity"), { target: { value: "high" } });
    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "open" } });

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/findings?severity=high&status=open",
        expect.objectContaining({
          headers: expect.any(Headers)
        })
      );
    });
  });

  it("shows finding details and updates status through the backend", async () => {
    const fetchSpy = vi.mocked(fetch);

    render(<App />);

    fireEvent.click((await screen.findAllByText("S3 bucket allows public access"))[0]!);

    expect(await screen.findByRole("heading", { name: "S3 bucket allows public access" })).toBeInTheDocument();
    expect(screen.getByText("Internet exposure")).toBeInTheDocument();
    expect(screen.getByText(/policyAllowsPublicRead/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Triaged" }));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/findings/finding-1/status",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "triaged" })
        })
      );
    });
  });

  it("surfaces filtered findings API errors without showing stale results", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);

        if (url === "/api/assets") {
          return jsonResponse(assets);
        }

        if (url === "/api/cloud-accounts") {
          return jsonResponse(cloudAccounts);
        }

        if (url === "/api/findings") {
          return jsonResponse(findings);
        }

        if (url.startsWith("/api/findings?")) {
          return new Response("denied", { status: 403 });
        }

        return new Response("not found", { status: 404 });
      })
    );

    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Findings" }));
    fireEvent.change(await screen.findByLabelText("Severity"), { target: { value: "critical" } });

    expect(await screen.findByRole("alert")).toHaveTextContent("You do not have permission for this action");
    expect(screen.queryByRole("button", { name: "S3 bucket allows public access" })).not.toBeInTheDocument();
  });

  it("does not leave stale detail data visible after a failed finding detail load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
        const url = String(input);

        if (url === "/api/assets") {
          return jsonResponse(assets);
        }

        if (url === "/api/cloud-accounts") {
          return jsonResponse(cloudAccounts);
        }

        if (url === "/api/findings") {
          return jsonResponse(findings);
        }

        if (url === "/api/findings/finding-1") {
          return new Response("not found", { status: 404 });
        }

        return new Response("not found", { status: 404 });
      })
    );

    render(<App />);

    fireEvent.click((await screen.findAllByText("S3 bucket allows public access"))[0]!);

    expect(await screen.findByRole("alert")).toHaveTextContent("The requested record was not found");
    expect(screen.queryByRole("heading", { name: "S3 bucket allows public access" })).not.toBeInTheDocument();
  });

  it("removes updated findings from the filtered list when the new status no longer matches", async () => {
    let mutableFindings = [...findings];

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        const url = String(input);
        const method = init?.method ?? "GET";

        if (url === "/api/assets") {
          return jsonResponse(assets);
        }

        if (url === "/api/cloud-accounts") {
          return jsonResponse(cloudAccounts);
        }

        if (url === "/api/findings?status=open") {
          return jsonResponse(mutableFindings.filter((finding) => finding.status === "open"));
        }

        if (url === "/api/findings") {
          return jsonResponse(mutableFindings);
        }

        if (url === "/api/findings/finding-1" && method === "GET") {
          return jsonResponse(mutableFindings[0]);
        }

        if (url === "/api/findings/finding-1/status" && method === "PATCH") {
          mutableFindings = mutableFindings.map((finding) =>
            finding.id === "finding-1" ? { ...finding, status: "triaged" } : finding
          );

          return jsonResponse(mutableFindings[0]);
        }

        return new Response("not found", { status: 404 });
      })
    );

    render(<App />);

    fireEvent.click(await screen.findByRole("link", { name: "Findings" }));
    fireEvent.change(await screen.findByLabelText("Status"), { target: { value: "open" } });
    fireEvent.click(await screen.findByRole("button", { name: "S3 bucket allows public access" }));
    fireEvent.click(await screen.findByRole("button", { name: "Triaged" }));
    expect(await screen.findByText("Triaged")).toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "← Back to findings" }));

    expect(await screen.findByText("No findings match the selected filters.")).toBeInTheDocument();
  });

  it("shows the login page when no access token is available", async () => {
    window.localStorage.clear();

    render(<App />);

    expect(await screen.findByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
  });
});

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  const method = init?.method ?? "GET";

  if (url === "/api/assets") {
    return jsonResponse(assets);
  }

  if (url === "/api/cloud-accounts") {
    return jsonResponse(cloudAccounts);
  }

  if (url.startsWith("/api/findings?")) {
    return jsonResponse(findings);
  }

  if (url === "/api/findings") {
    return jsonResponse(findings);
  }

  if (url === "/api/findings/finding-1" && method === "GET") {
    return jsonResponse(findings[0]);
  }

  if (url === "/api/findings/finding-1/status" && method === "PATCH") {
    return jsonResponse({
      ...findings[0],
      status: "triaged"
    });
  }

  return new Response("not found", { status: 404 });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json"
    },
    status: 200
  });
}
