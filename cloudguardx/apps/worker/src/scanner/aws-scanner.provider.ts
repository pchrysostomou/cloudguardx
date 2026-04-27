import { MockAwsReadOnlyScanner } from "@cloudguardx/aws-connectors";
import type { AwsReadOnlyScanner } from "@cloudguardx/aws-connectors";

export const AWS_SCANNER = Symbol("AWS_SCANNER");

export function awsScannerFactory(): AwsReadOnlyScanner {
  return new MockAwsReadOnlyScanner();
}
