import { ScanJobStatus } from "@prisma/client";
import { ScanJobState } from "@cloudguardx/shared-types";

export function mapScanJobStatus(status: ScanJobStatus): ScanJobState {
  switch (status) {
    case ScanJobStatus.QUEUED:
      return ScanJobState.Pending;
    case ScanJobStatus.RUNNING:
      return ScanJobState.Running;
    case ScanJobStatus.SUCCEEDED:
      return ScanJobState.Completed;
    case ScanJobStatus.FAILED:
    case ScanJobStatus.CANCELED:
      return ScanJobState.Failed;
    default:
      throw new Error(`Unsupported scan job status: ${status satisfies never}`);
  }
}
