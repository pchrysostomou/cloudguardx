import "./styles.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { FindingSeverity, FindingStatus } from "@cloudguardx/shared-types";
import type { AssetSummary, FindingSummary } from "@cloudguardx/shared-types";
import { accessTokenFromStorage, createCloudGuardApiClient } from "./api/cloudguardx";
import type { AppRoute, FindingFilters, PostureData } from "./types";

const navigationItems: ReadonlyArray<{ label: string; route: AppRoute }> = [
  { label: "Overview", route: { view: "overview" } },
  { label: "Assets", route: { view: "assets" } },
  { label: "Findings", route: { view: "findings" } }
];

const severityOptions = [
  FindingSeverity.Critical,
  FindingSeverity.High,
  FindingSeverity.Medium,
  FindingSeverity.Low,
  FindingSeverity.Informational
] as const;

const statusOptions = [
  FindingStatus.Open,
  FindingStatus.Triaged,
  FindingStatus.RiskAccepted,
  FindingStatus.Resolved
] as const;

const initialPostureData: PostureData = {
  assets: [],
  findings: [],
  cloudAccounts: []
};

type LoadStatus = "idle" | "loading" | "ready" | "error";

export function App(): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash(window.location.hash));
  const [accessToken] = useState(() => accessTokenFromStorage());
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postureData, setPostureData] = useState<PostureData>(initialPostureData);
  const [findingFilters, setFindingFilters] = useState<FindingFilters>({});
  const [filteredFindings, setFilteredFindings] = useState<FindingSummary[]>([]);
  const [findingsStatus, setFindingsStatus] = useState<LoadStatus>("idle");
  const [findingsErrorMessage, setFindingsErrorMessage] = useState<string | null>(null);
  const [selectedFinding, setSelectedFinding] = useState<FindingSummary | null>(null);
  const [detailStatus, setDetailStatus] = useState<LoadStatus>("idle");
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const apiClient = useMemo(() => createCloudGuardApiClient({ accessToken }), [accessToken]);

  const navigate = useCallback((nextRoute: AppRoute) => {
    window.location.hash = hashFromRoute(nextRoute);
    setRoute(nextRoute);
  }, []);

  const loadPostureData = useCallback(async () => {
    if (!accessToken) {
      setLoadStatus("error");
      setErrorMessage("API access token not found");
      return;
    }

    setLoadStatus("loading");
    setErrorMessage(null);

    try {
      const [assets, findings, cloudAccounts] = await Promise.all([
        apiClient.listAssets(),
        apiClient.listFindings(),
        apiClient.listCloudAccounts()
      ]);

      setPostureData({ assets, findings, cloudAccounts });
      setFilteredFindings(findings);
      setLoadStatus("ready");
    } catch (error) {
      setLoadStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load posture data");
    }
  }, [accessToken, apiClient]);

  const loadFilteredFindings = useCallback(async () => {
    if (!accessToken) {
      return;
    }

    setFindingsStatus("loading");
    setFindingsErrorMessage(null);

    try {
      const findings = await apiClient.listFindings(findingFilters);
      setFilteredFindings(findings);
      setFindingsStatus("ready");
    } catch (error) {
      setFindingsStatus("error");
      setFindingsErrorMessage(error instanceof Error ? error.message : "Unable to load findings");
    }
  }, [accessToken, apiClient, findingFilters]);

  const loadFindingDetails = useCallback(
    async (findingId: string) => {
      if (!accessToken) {
        return;
      }

      setDetailStatus("loading");
      setSelectedFinding(null);
      setDetailErrorMessage(null);
      setStatusUpdateError(null);

      try {
        const finding = await apiClient.getFinding(findingId);
        setSelectedFinding(finding);
        setDetailStatus("ready");
      } catch (error) {
        setDetailStatus("error");
        setDetailErrorMessage(error instanceof Error ? error.message : "Unable to load finding");
      }
    },
    [accessToken, apiClient]
  );

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash(window.location.hash));

    window.addEventListener("hashchange", onHashChange);

    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    void loadPostureData();
  }, [loadPostureData]);

  useEffect(() => {
    if (route.view === "findings") {
      void loadFilteredFindings();
    }
  }, [loadFilteredFindings, route.view]);

  useEffect(() => {
    if (route.view === "finding" && route.findingId) {
      void loadFindingDetails(route.findingId);
    }
  }, [loadFindingDetails, route.findingId, route.view]);

  const metrics = useMemo(() => metricsFrom(postureData), [postureData]);
  const recentFindings = postureData.findings.slice(0, 6);
  const criticalOrHighFindings = postureData.findings.filter(
    (finding) =>
      finding.status !== FindingStatus.Resolved &&
      (finding.severity === FindingSeverity.Critical || finding.severity === FindingSeverity.High)
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            CG
          </div>
          <div>
            <p className="brand-name">CloudGuardX</p>
            <p className="tenant-label">Security workspace</p>
          </div>
        </div>

        <nav aria-label="Primary" className="nav-list">
          {navigationItems.map((item) => (
            <a
              className={routeIsActive(route, item.route) ? "nav-item active" : "nav-item"}
              href={hashFromRoute(item.route)}
              key={item.label}
              onClick={() => setRoute(item.route)}
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">Posture command center</p>
            <h1>{pageTitle(route)}</h1>
          </div>
          <button className="secondary-action" onClick={() => void loadPostureData()} type="button">
            Refresh
          </button>
        </header>

        {loadStatus === "loading" ? <LoadingState label="Loading posture data" /> : null}
        {loadStatus === "error" ? <ErrorState message={errorMessage ?? "Unable to load posture data"} onRetry={loadPostureData} /> : null}

        {loadStatus === "ready" && route.view === "overview" ? (
          <OverviewPage
            assets={postureData.assets}
            criticalOrHighFindings={criticalOrHighFindings}
            metrics={metrics}
            onFindingOpen={(findingId) => navigate({ view: "finding", findingId })}
            recentFindings={recentFindings}
          />
        ) : null}

        {loadStatus === "ready" && route.view === "assets" ? <AssetsPage assets={postureData.assets} /> : null}

        {loadStatus === "ready" && route.view === "findings" ? (
          <FindingsPage
            filters={findingFilters}
            errorMessage={findingsErrorMessage}
            findings={filteredFindings}
            loading={findingsStatus === "loading"}
            onFilterChange={setFindingFilters}
            onRetry={() => void loadFilteredFindings()}
            onFindingOpen={(findingId) => navigate({ view: "finding", findingId })}
          />
        ) : null}

        {loadStatus === "ready" && route.view === "finding" ? (
          <FindingDetailsPage
            errorMessage={detailErrorMessage}
            finding={selectedFinding}
            hasError={detailStatus === "error"}
            loading={detailStatus === "loading"}
            onBack={() => navigate({ view: "findings" })}
            onStatusUpdate={(status) => void updateFindingStatus(status)}
            statusUpdateError={statusUpdateError}
            updating={statusUpdating}
          />
        ) : null}
      </main>
    </div>
  );

  async function updateFindingStatus(status: FindingStatus): Promise<void> {
    if (!route.findingId || !selectedFinding) {
      return;
    }

    setStatusUpdating(true);
    setStatusUpdateError(null);

    try {
      const updated = await apiClient.updateFindingStatus(route.findingId, status);
      setSelectedFinding(updated);
      setPostureData((current) => ({
        ...current,
        findings: replaceFinding(current.findings, updated)
      }));
      setFilteredFindings((current) =>
        matchesFindingFilters(updated, findingFilters) ? replaceFinding(current, updated) : current.filter((finding) => finding.id !== updated.id)
      );
    } catch (error) {
      setStatusUpdateError(error instanceof Error ? error.message : "Unable to update finding status");
    } finally {
      setStatusUpdating(false);
    }
  }
}

function OverviewPage(props: {
  assets: AssetSummary[];
  criticalOrHighFindings: FindingSummary[];
  metrics: ReadonlyArray<{ label: string; value: string; tone: string }>;
  onFindingOpen: (findingId: string) => void;
  recentFindings: FindingSummary[];
}): ReactElement {
  const assetTypeCounts = countAssetsByType(props.assets);

  return (
    <>
      <section className="summary-grid" aria-label="Security posture summary">
        {props.metrics.map((metric) => (
          <article className={`metric-card ${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="dashboard-grid" aria-label="Posture overview">
        <Panel title="Recent findings">
          {props.recentFindings.length > 0 ? (
            <FindingList findings={props.recentFindings} onFindingOpen={props.onFindingOpen} />
          ) : (
            <EmptyState title="No findings" body="Completed scans have not produced findings." />
          )}
        </Panel>

        <Panel title="Asset mix">
          {assetTypeCounts.length > 0 ? (
            <div className="stacked-list">
              {assetTypeCounts.map((entry) => (
                <div className="stacked-row" key={entry.type}>
                  <span>{formatResourceType(entry.type)}</span>
                  <strong>{entry.count}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No assets" body="Run a scan to populate inventory." />
          )}
        </Panel>

        <Panel title="Priority queue">
          {props.criticalOrHighFindings.length > 0 ? (
            <FindingList findings={props.criticalOrHighFindings.slice(0, 5)} onFindingOpen={props.onFindingOpen} />
          ) : (
            <EmptyState title="No high-priority findings" body="Open critical and high findings will appear here." />
          )}
        </Panel>
      </section>
    </>
  );
}

function AssetsPage({ assets }: { assets: AssetSummary[] }): ReactElement {
  if (assets.length === 0) {
    return <EmptyState body="Inventory will populate after a successful scan." title="No assets found" />;
  }

  return (
    <section className="table-panel" aria-labelledby="assets-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inventory</p>
          <h2 id="assets-title">Assets</h2>
        </div>
        <span className="status-pill">{assets.length} total</span>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Region</th>
              <th>Sensitivity</th>
              <th>Criticality</th>
              <th>Last seen</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset) => (
              <tr key={asset.id}>
                <td>
                  <strong>{asset.name}</strong>
                  <span className="muted-text">{asset.arn ?? asset.externalId}</span>
                </td>
                <td>{formatResourceType(asset.resourceType)}</td>
                <td>{asset.region ?? "Global"}</td>
                <td>{asset.sensitivity}</td>
                <td>{asset.criticality}</td>
                <td>{formatDate(asset.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FindingsPage(props: {
  errorMessage: string | null;
  filters: FindingFilters;
  findings: FindingSummary[];
  loading: boolean;
  onFilterChange: (filters: FindingFilters) => void;
  onRetry: () => void;
  onFindingOpen: (findingId: string) => void;
}): ReactElement {
  return (
    <section className="table-panel" aria-labelledby="findings-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Findings</p>
          <h2 id="findings-title">Findings</h2>
        </div>
        <span className="status-pill">{props.findings.length} shown</span>
      </div>

      <div className="filter-row" aria-label="Finding filters">
        <label>
          Severity
          <select
            onChange={(event) =>
              props.onFilterChange({
                ...props.filters,
                severity: event.target.value ? (event.target.value as FindingSeverity) : undefined
              })
            }
            value={props.filters.severity ?? ""}
          >
            <option value="">All</option>
            {severityOptions.map((severity) => (
              <option key={severity} value={severity}>
                {formatFindingValue(severity)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select
            onChange={(event) =>
              props.onFilterChange({
                ...props.filters,
                status: event.target.value ? (event.target.value as FindingStatus) : undefined
              })
            }
            value={props.filters.status ?? ""}
          >
            <option value="">All</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {formatFindingValue(status)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {props.loading ? <LoadingState label="Loading findings" compact /> : null}
      {!props.loading && props.errorMessage ? (
        <InlineErrorState message={props.errorMessage} onRetry={props.onRetry} />
      ) : null}
      {!props.loading && !props.errorMessage && props.findings.length === 0 ? (
        <EmptyState body="No findings match the selected filters." title="No findings found" />
      ) : null}
      {!props.loading && !props.errorMessage && props.findings.length > 0 ? (
        <FindingTable findings={props.findings} onFindingOpen={props.onFindingOpen} />
      ) : null}
    </section>
  );
}

function FindingDetailsPage(props: {
  errorMessage: string | null;
  finding: FindingSummary | null;
  hasError: boolean;
  loading: boolean;
  onBack: () => void;
  onStatusUpdate: (status: FindingStatus) => void;
  statusUpdateError: string | null;
  updating: boolean;
}): ReactElement {
  if (props.loading) {
    return <LoadingState label="Loading finding" />;
  }

  if (props.hasError) {
    return (
      <section className="detail-panel">
        <button className="text-action" onClick={props.onBack} type="button">
          Back to findings
        </button>
        <InlineErrorState message={props.errorMessage ?? "Unable to load finding"} />
      </section>
    );
  }

  if (!props.finding) {
    return <EmptyState body="The selected finding could not be loaded." title="Finding unavailable" />;
  }

  const finding = props.finding;

  return (
    <section className="detail-panel" aria-labelledby="finding-detail-title">
      <button className="text-action" onClick={props.onBack} type="button">
        Back to findings
      </button>

      <div className="detail-header">
        <div>
          <p className="eyebrow">Finding detail</p>
          <h2 id="finding-detail-title">{finding.title}</h2>
        </div>
        <div className="badge-row">
          <SeverityBadge severity={finding.severity} />
          <StatusBadge status={finding.status} />
        </div>
      </div>

      <p className="detail-description">{finding.description ?? "No description available."}</p>

      <div className="detail-grid">
        <Panel title="Risk score">
          <div className="risk-score">
            <strong>{Math.round(finding.score)}</strong>
            <span>{formatFindingValue(finding.severity)}</span>
          </div>
          {finding.riskScore ? (
            <div className="factor-list">
              {Object.entries(finding.riskScore.factors).map(([factor, value]) => (
                <div className="factor-row" key={factor}>
                  <span>{formatFactorName(factor)}</span>
                  <strong>{String(value)}</strong>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState body="Risk score factors are not available." title="No factors" compact />
          )}
        </Panel>

        <Panel title="Status">
          <div className="status-actions">
            {statusOptions.map((status) => (
              <button
                className={finding.status === status ? "segmented active" : "segmented"}
                disabled={props.updating || finding.status === status}
                key={status}
                onClick={() => props.onStatusUpdate(status)}
                type="button"
              >
                {formatFindingValue(status)}
              </button>
            ))}
          </div>
          {props.statusUpdateError ? <p className="inline-error">{props.statusUpdateError}</p> : null}
        </Panel>

        <Panel title="Evidence">
          <pre className="json-block">{JSON.stringify(finding.evidence ?? {}, null, 2)}</pre>
        </Panel>

        <Panel title="Metadata">
          <dl className="metadata-list">
            <div>
              <dt>Asset</dt>
              <dd>{finding.assetId ?? "None"}</dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>{finding.policyId ?? "None"}</dd>
            </div>
            <div>
              <dt>First seen</dt>
              <dd>{formatDate(finding.firstSeenAt)}</dd>
            </div>
            <div>
              <dt>Last seen</dt>
              <dd>{formatDate(finding.lastSeenAt)}</dd>
            </div>
            <div>
              <dt>Resolved</dt>
              <dd>{finding.resolvedAt ? formatDate(finding.resolvedAt) : "Open"}</dd>
            </div>
          </dl>
        </Panel>
      </div>
    </section>
  );
}

function FindingTable(props: {
  findings: FindingSummary[];
  onFindingOpen: (findingId: string) => void;
}): ReactElement {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Finding</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Score</th>
            <th>Last seen</th>
          </tr>
        </thead>
        <tbody>
          {props.findings.map((finding) => (
            <tr key={finding.id}>
              <td>
                <button className="link-button" onClick={() => props.onFindingOpen(finding.id)} type="button">
                  {finding.title}
                </button>
                <span className="muted-text">{finding.assetId ?? "No asset"}</span>
              </td>
              <td>
                <SeverityBadge severity={finding.severity} />
              </td>
              <td>
                <StatusBadge status={finding.status} />
              </td>
              <td>{Math.round(finding.score)}</td>
              <td>{formatDate(finding.lastSeenAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FindingList(props: {
  findings: FindingSummary[];
  onFindingOpen: (findingId: string) => void;
}): ReactElement {
  return (
    <div className="finding-list">
      {props.findings.map((finding) => (
        <button className="finding-list-row" key={finding.id} onClick={() => props.onFindingOpen(finding.id)} type="button">
          <span>{finding.title}</span>
          <span className="badge-row">
            <SeverityBadge severity={finding.severity} />
            <strong>{Math.round(finding.score)}</strong>
          </span>
        </button>
      ))}
    </div>
  );
}

function Panel({ children, title }: { children: ReactNode; title: string }): ReactElement {
  return (
    <section className="panel" aria-label={title}>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function LoadingState({ compact = false, label }: { compact?: boolean; label: string }): ReactElement {
  return (
    <div className={compact ? "state-block compact" : "state-block"} role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void | Promise<void> }): ReactElement {
  return (
    <section className="state-block error" role="alert">
      <h2>Unable to load data</h2>
      <p>{message}</p>
      <button className="secondary-action" onClick={() => void onRetry()} type="button">
        Retry
      </button>
    </section>
  );
}

function InlineErrorState({ message, onRetry }: { message: string; onRetry?: () => void }): ReactElement {
  return (
    <div className="inline-error-panel" role="alert">
      <div>
        <h3>Unable to load data</h3>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button className="secondary-action" onClick={onRetry} type="button">
          Retry
        </button>
      ) : null}
    </div>
  );
}

function EmptyState({ body, compact = false, title }: { body: string; compact?: boolean; title: string }): ReactElement {
  return (
    <div className={compact ? "empty-state compact" : "empty-state"}>
      <h3>{title}</h3>
      <p>{body}</p>
    </div>
  );
}

function SeverityBadge({ severity }: { severity: FindingSeverity }): ReactElement {
  return <span className={`badge severity-${severity}`}>{formatFindingValue(severity)}</span>;
}

function StatusBadge({ status }: { status: FindingStatus }): ReactElement {
  return <span className={`badge status-${status}`}>{formatFindingValue(status)}</span>;
}

function metricsFrom(data: PostureData): ReadonlyArray<{ label: string; value: string; tone: string }> {
  const openFindings = data.findings.filter((finding) => finding.status !== FindingStatus.Resolved);
  const criticalFindings = openFindings.filter((finding) => finding.severity === FindingSeverity.Critical);
  const maxRiskScore = openFindings.reduce((max, finding) => Math.max(max, finding.score), 0);

  return [
    { label: "Cloud accounts", value: String(data.cloudAccounts.length), tone: "neutral" },
    { label: "Assets", value: String(data.assets.length), tone: "neutral" },
    { label: "Open findings", value: String(openFindings.length), tone: "risk" },
    { label: "Critical findings", value: String(criticalFindings.length), tone: "critical" },
    { label: "Max risk score", value: String(Math.round(maxRiskScore)), tone: "score" }
  ];
}

function replaceFinding(findings: FindingSummary[], updated: FindingSummary): FindingSummary[] {
  return findings.map((finding) => (finding.id === updated.id ? updated : finding));
}

function matchesFindingFilters(finding: FindingSummary, filters: FindingFilters): boolean {
  return (!filters.severity || finding.severity === filters.severity) && (!filters.status || finding.status === filters.status);
}

function routeIsActive(current: AppRoute, target: AppRoute): boolean {
  if (current.view === "finding" && target.view === "findings") {
    return true;
  }

  return current.view === target.view;
}

function routeFromHash(hash: string): AppRoute {
  const normalized = hash.replace(/^#\/?/, "");
  const [view, findingId] = normalized.split("/");

  if (view === "assets") {
    return { view: "assets" };
  }

  if (view === "findings" && findingId) {
    return { view: "finding", findingId };
  }

  if (view === "findings") {
    return { view: "findings" };
  }

  return { view: "overview" };
}

function hashFromRoute(route: AppRoute): string {
  if (route.view === "finding" && route.findingId) {
    return `#/findings/${route.findingId}`;
  }

  if (route.view === "assets") {
    return "#/assets";
  }

  if (route.view === "findings") {
    return "#/findings";
  }

  return "#/overview";
}

function pageTitle(route: AppRoute): string {
  if (route.view === "assets") {
    return "Assets";
  }

  if (route.view === "findings") {
    return "Findings";
  }

  if (route.view === "finding") {
    return "Finding details";
  }

  return "Overview";
}

function countAssetsByType(assets: AssetSummary[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();

  for (const asset of assets) {
    counts.set(asset.resourceType, (counts.get(asset.resourceType) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

function formatResourceType(value: string): string {
  return value
    .split("_")
    .map((part) => {
      if (/^(aws|s3|ec2|iam|rds|ecr|kms)$/i.test(part)) {
        return part.toUpperCase();
      }

      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function formatFindingValue(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFactorName(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`).replace(/^./, (letter) => letter.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}
