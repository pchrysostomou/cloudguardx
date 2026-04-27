import { describe, expect, it } from "vitest";
import { CloudProvider } from "@cloudguardx/shared-types";
import { MockAwsReadOnlyScanner } from "./index";

describe("MockAwsReadOnlyScanner", () => {
  it("returns explicitly mocked read-only scan metadata", async () => {
    const scanner = new MockAwsReadOnlyScanner();

    const result = await scanner.scan({
      account: {
        id: "account-1",
        tenantId: "tenant-1",
        provider: CloudProvider.Aws,
        externalAccountId: "123456789012",
        name: "Production"
      },
      roleArn: "arn:aws:iam::123456789012:role/CloudGuardXReadOnly",
      regions: ["us-east-1"],
      endpointUrl: "http://localhost:4566"
    });

    expect(result.scannerMode).toBe("mock");
    expect(result.metadata.readOnly).toBe(true);
    expect(result.metadata.mutatingCallsAttempted).toBe(false);
    expect(result.resources).toHaveLength(3);
    expect(result.resources[0]?.metadata).toEqual(
      expect.objectContaining({
        publicAccess: expect.objectContaining({
          policyAllowsPublicRead: true
        }),
        publicAccessBlock: expect.objectContaining({
          blockPublicPolicy: false
        })
      })
    );
    expect(result.resources[1]?.metadata).toEqual(
      expect.objectContaining({
        ingressRules: [
          expect.objectContaining({
            fromPort: 22,
            cidrIpv4: "0.0.0.0/0"
          })
        ]
      })
    );
  });
});
