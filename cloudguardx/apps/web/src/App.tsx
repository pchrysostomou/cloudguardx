import "./styles.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { FindingSeverity, FindingStatus } from "@cloudguardx/shared-types";
import type { AssetSummary, FindingSummary } from "@cloudguardx/shared-types";
import {
  accessTokenFromStorage,
  clearTokensFromStorage,
  createCloudGuardApiClient,
  refreshTokenFromStorage,
  saveTokensToStorage
} from "./api/cloudguardx";
import type {
  ActivityEntry,
  AppRoute,
  CloudAccountSummary,
  ConnectAccountFormData,
  FindingFilters,
  PostureData
} from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const navigationItems: ReadonlyArray<{ label: string; route: AppRoute; icon: string }> = [
  { label: "Overview", route: { view: "overview" }, icon: "⬡" },
  { label: "Cloud Accounts", route: { view: "cloud-accounts" }, icon: "☁" },
  { label: "Assets", route: { view: "assets" }, icon: "◈" },
  { label: "Findings", route: { view: "findings" }, icon: "⚑" }
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

const SEVERITY_BARS = [
  { severity: FindingSeverity.Critical, label: "Critical", color: "#b42318" },
  { severity: FindingSeverity.High, label: "High", color: "#b54708" },
  { severity: FindingSeverity.Medium, label: "Medium", color: "#026aa2" },
  { severity: FindingSeverity.Low, label: "Low", color: "#067647" },
  { severity: FindingSeverity.Informational, label: "Info", color: "#475467" }
] as const;

const initialPostureData: PostureData = { assets: [], findings: [], cloudAccounts: [] };

type LoadStatus = "idle" | "loading" | "ready" | "error";

// ---------------------------------------------------------------------------
// Root component
// ---------------------------------------------------------------------------

export function App(): ReactElement {
  const [route, setRoute] = useState<AppRoute>(() => routeFromHash(window.location.hash));
  const [accessToken, setAccessToken] = useState<string | null>(() => accessTokenFromStorage());

  // Auth state
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Posture data
  const [loadStatus, setLoadStatus] = useState<LoadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postureData, setPostureData] = useState<PostureData>(initialPostureData);

  // Findings page
  const [findingFilters, setFindingFilters] = useState<FindingFilters>({});
  const [filteredFindings, setFilteredFindings] = useState<FindingSummary[]>([]);
  const [findingsStatus, setFindingsStatus] = useState<LoadStatus>("idle");
  const [findingsErrorMessage, setFindingsErrorMessage] = useState<string | null>(null);

  // Finding detail
  const [selectedFinding, setSelectedFinding] = useState<FindingSummary | null>(null);
  const [detailStatus, setDetailStatus] = useState<LoadStatus>("idle");
  const [detailErrorMessage, setDetailErrorMessage] = useState<string | null>(null);
  const [statusUpdateError, setStatusUpdateError] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);

  // Connect account modal
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const apiClient = useMemo(() => createCloudGuardApiClient({ accessToken }), [accessToken]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const navigate = useCallback((nextRoute: AppRoute) => {
    window.location.hash = hashFromRoute(nextRoute);
    setRoute(nextRoute);
  }, []);

  useEffect(() => {
    const onHashChange = () => setRoute(routeFromHash(window.location.hash));
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // ---------------------------------------------------------------------------
  // Auth
  // ---------------------------------------------------------------------------

  const handleSessionExpired = useCallback(() => {
    clearTokensFromStorage();
    setAccessToken(null);
    setPostureData(initialPostureData);
    setLoadStatus("idle");
  }, []);

  async function handleLogin(email: string, password: string): Promise<void> {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const unauthClient = createCloudGuardApiClient();
      const result = await unauthClient.login(email, password);
      saveTokensToStorage(result.accessToken, result.refreshToken);
      setAccessToken(result.accessToken);
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Sign-in failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleLogout(): Promise<void> {
    const refreshToken = refreshTokenFromStorage();
    if (refreshToken) {
      try {
        await apiClient.logout(refreshToken);
      } catch {
        // best-effort — clear locally regardless
      }
    }
    clearTokensFromStorage();
    setAccessToken(null);
    setPostureData(initialPostureData);
    setLoadStatus("idle");
    navigate({ view: "overview" });
  }

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadPostureData = useCallback(async () => {
    if (!accessToken) return;

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
      if (error instanceof Error && error.message.includes("rejected")) {
        handleSessionExpired();
        return;
      }
      setLoadStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Unable to load posture data");
    }
  }, [accessToken, apiClient, handleSessionExpired]);

  const loadFilteredFindings = useCallback(async () => {
    if (!accessToken) return;

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
      if (!accessToken) return;

      setDetailStatus("loading");
      setSelectedFinding(null);
      setDetailErrorMessage(null);
      setStatusUpdateError(null);
      setActivityLog([]);

      try {
        const finding = await apiClient.getFinding(findingId);
        setSelectedFinding(finding);
        setActivityLog([
          {
            id: `initial-${finding.id}`,
            status: finding.status,
            timestamp: finding.lastSeenAt,
            label: "Opened"
          }
        ]);
        setDetailStatus("ready");
      } catch (error) {
        setDetailStatus("error");
        setDetailErrorMessage(error instanceof Error ? error.message : "Unable to load finding");
      }
    },
    [accessToken, apiClient]
  );

  useEffect(() => {
    if (accessToken) {
      void loadPostureData();
    }
  }, [loadPostureData, accessToken]);

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

  // ---------------------------------------------------------------------------
  // Finding status update
  // ---------------------------------------------------------------------------

  async function updateFindingStatus(status: FindingStatus): Promise<void> {
    if (!route.findingId || !selectedFinding) return;

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
        matchesFindingFilters(updated, findingFilters)
          ? replaceFinding(current, updated)
          : current.filter((f) => f.id !== updated.id)
      );
      setActivityLog((prev) => [
        {
          id: String(Date.now()),
          status,
          timestamp: new Date().toISOString(),
          label: `Status set to ${formatFindingValue(status)}`
        },
        ...prev
      ]);
    } catch (error) {
      setStatusUpdateError(error instanceof Error ? error.message : "Unable to update finding status");
    } finally {
      setStatusUpdating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Connect AWS account
  // ---------------------------------------------------------------------------

  async function handleConnectAccount(data: ConnectAccountFormData): Promise<void> {
    setConnectLoading(true);
    setConnectError(null);
    try {
      const account = await apiClient.connectAwsAccount(data);
      setPostureData((prev) => ({
        ...prev,
        cloudAccounts: [...prev.cloudAccounts, account]
      }));
      setShowConnectModal(false);
    } catch (error) {
      setConnectError(error instanceof Error ? error.message : "Failed to connect account");
    } finally {
      setConnectLoading(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------

  const metrics = useMemo(() => metricsFrom(postureData), [postureData]);
  const recentFindings = postureData.findings.slice(0, 6);
  const criticalOrHighFindings = postureData.findings.filter(
    (f) =>
      f.status !== FindingStatus.Resolved &&
      (f.severity === FindingSeverity.Critical || f.severity === FindingSeverity.High)
  );

  // ---------------------------------------------------------------------------
  // Render — login gate
  // ---------------------------------------------------------------------------

  if (!accessToken) {
    return <LoginPage error={loginError} loading={loginLoading} onLogin={handleLogin} />;
  }

  // ---------------------------------------------------------------------------
  // Render — main shell
  // ---------------------------------------------------------------------------

  return (
    <div className="app-shell">
      {showConnectModal ? (
        <ConnectAccountModal
          error={connectError}
          loading={connectLoading}
          onClose={() => {
            setShowConnectModal(false);
            setConnectError(null);
          }}
          onSubmit={handleConnectAccount}
        />
      ) : null}

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
              <span className="nav-icon" aria-hidden="true">
                {item.icon}
              </span>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-button" onClick={() => void handleLogout()} type="button">
            Sign out
          </button>
        </div>
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

        {loadStatus === "loading" ? <SkeletonDashboard /> : null}
        {loadStatus === "error" ? (
          <ErrorState message={errorMessage ?? "Unable to load posture data"} onRetry={loadPostureData} />
        ) : null}

        {loadStatus === "ready" && route.view === "overview" ? (
          <OverviewPage
            assets={postureData.assets}
            criticalOrHighFindings={criticalOrHighFindings}
            findings={postureData.findings}
            metrics={metrics}
            onConnectAccount={() => setShowConnectModal(true)}
            onFindingOpen={(findingId) => navigate({ view: "finding", findingId })}
            recentFindings={recentFindings}
          />
        ) : null}

        {loadStatus === "ready" && route.view === "cloud-accounts" ? (
          <CloudAccountsPage
            cloudAccounts={postureData.cloudAccounts}
            onConnect={() => setShowConnectModal(true)}
          />
        ) : null}

        {loadStatus === "ready" && route.view === "assets" ? <AssetsPage assets={postureData.assets} /> : null}

        {loadStatus === "ready" && route.view === "findings" ? (
          <FindingsPage
            errorMessage={findingsErrorMessage}
            filters={findingFilters}
            findings={filteredFindings}
            loading={findingsStatus === "loading"}
            onFilterChange={setFindingFilters}
            onFindingOpen={(findingId) => navigate({ view: "finding", findingId })}
            onRetry={() => void loadFilteredFindings()}
          />
        ) : null}

        {loadStatus === "ready" && route.view === "finding" ? (
          <FindingDetailsPage
            activityLog={activityLog}
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
}

// ---------------------------------------------------------------------------
// Login page
// ---------------------------------------------------------------------------

function LoginPage(props: {
  error: string | null;
  loading: boolean;
  onLogin: (email: string, password: string) => Promise<void>;
}): ReactElement {
  const [email, setEmail] = useState("demo@cloudguardx.local");
  const [password, setPassword] = useState("CloudGuardX-Demo-123!");
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void props.onLogin(email, password);
  }

  return (
    <div className="login-shell">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark" aria-hidden="true">
            CG
          </div>
          <div>
            <p className="brand-name">CloudGuardX</p>
            <p className="login-subtitle">Cloud Security Posture Management</p>
          </div>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Email
            <input
              autoComplete="email"
              className="field-input"
              onChange={(e) => setEmail(e.target.value)}
              ref={emailRef}
              required
              type="email"
              value={email}
            />
          </label>

          <label className="field-label">
            Password
            <input
              autoComplete="current-password"
              className="field-input"
              onChange={(e) => setPassword(e.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          {props.error ? <p className="login-error" role="alert">{props.error}</p> : null}

          <button className="primary-action" disabled={props.loading} type="submit">
            {props.loading ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="login-hint">Demo credentials are pre-filled. Just click Sign in.</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview page
// ---------------------------------------------------------------------------

function OverviewPage(props: {
  assets: AssetSummary[];
  criticalOrHighFindings: FindingSummary[];
  findings: FindingSummary[];
  metrics: ReadonlyArray<{ label: string; value: string; tone: string }>;
  onConnectAccount: () => void;
  onFindingOpen: (findingId: string) => void;
  recentFindings: FindingSummary[];
}): ReactElement {
  const assetTypeCounts = countAssetsByType(props.assets);

  return (
    <>
      <section aria-label="Security posture summary" className="summary-grid">
        {props.metrics.map((metric) => (
          <article className={`metric-card ${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section aria-label="Posture overview" className="dashboard-grid">
        <Panel title="Recent findings">
          {props.recentFindings.length > 0 ? (
            <FindingList findings={props.recentFindings} onFindingOpen={props.onFindingOpen} />
          ) : (
            <EmptyState body="Completed scans have not produced findings." title="No findings" />
          )}
        </Panel>

        <Panel title="Findings by severity">
          <SeverityChart findings={props.findings} />
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
            <EmptyState body="Run a scan to populate inventory." title="No assets" />
          )}
        </Panel>

        <Panel title="Priority queue">
          {props.criticalOrHighFindings.length > 0 ? (
            <FindingList findings={props.criticalOrHighFindings.slice(0, 5)} onFindingOpen={props.onFindingOpen} />
          ) : (
            <EmptyState body="Open critical and high findings will appear here." title="No high-priority findings" />
          )}
        </Panel>
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Cloud accounts page
// ---------------------------------------------------------------------------

function CloudAccountsPage(props: {
  cloudAccounts: CloudAccountSummary[];
  onConnect: () => void;
}): ReactElement {
  return (
    <section aria-labelledby="accounts-title" className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Cloud infrastructure</p>
          <h2 id="accounts-title">Cloud Accounts</h2>
        </div>
        <button className="primary-action" onClick={props.onConnect} type="button">
          + Connect AWS Account
        </button>
      </div>

      {props.cloudAccounts.length === 0 ? (
        <EmptyState
          body="Connect your first AWS account to start scanning your cloud infrastructure."
          title="No cloud accounts connected"
        />
      ) : (
        <div className="accounts-grid">
          {props.cloudAccounts.map((account) => (
            <AccountCard account={account} key={account.id} />
          ))}
        </div>
      )}
    </section>
  );
}

function AccountCard({ account }: { account: CloudAccountSummary }): ReactElement {
  const statusClass =
    account.status === "ACTIVE"
      ? "account-status active"
      : account.status === "ERROR"
        ? "account-status error"
        : "account-status pending";

  return (
    <div className="account-card">
      <div className="account-card-header">
        <div className="account-provider-badge">AWS</div>
        <span className={statusClass}>{account.status}</span>
      </div>
      <p className="account-name">{account.name}</p>
      <p className="account-id muted-text">{account.externalAccountId}</p>
      <dl className="account-meta">
        <div>
          <dt>Last scan</dt>
          <dd>{account.lastSuccessfulScanAt ? formatDate(account.lastSuccessfulScanAt) : "Never"}</dd>
        </div>
        {account.lastScanError ? (
          <div>
            <dt>Last error</dt>
            <dd className="account-error">{account.lastScanError}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Assets page
// ---------------------------------------------------------------------------

function AssetsPage({ assets }: { assets: AssetSummary[] }): ReactElement {
  if (assets.length === 0) {
    return <EmptyState body="Inventory will populate after a successful scan." title="No assets found" />;
  }

  return (
    <section aria-labelledby="assets-title" className="table-panel">
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

// ---------------------------------------------------------------------------
// Findings page
// ---------------------------------------------------------------------------

function FindingsPage(props: {
  errorMessage: string | null;
  filters: FindingFilters;
  findings: FindingSummary[];
  loading: boolean;
  onFilterChange: (filters: FindingFilters) => void;
  onFindingOpen: (findingId: string) => void;
  onRetry: () => void;
}): ReactElement {
  return (
    <section aria-labelledby="findings-title" className="table-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Security findings</p>
          <h2 id="findings-title">Findings</h2>
        </div>
        <span className="status-pill">{props.findings.length} shown</span>
      </div>

      <div aria-label="Finding filters" className="filter-row">
        <label>
          Severity
          <select
            onChange={(e) =>
              props.onFilterChange({
                ...props.filters,
                severity: e.target.value ? (e.target.value as FindingSeverity) : undefined
              })
            }
            value={props.filters.severity ?? ""}
          >
            <option value="">All severities</option>
            {severityOptions.map((s) => (
              <option key={s} value={s}>
                {formatFindingValue(s)}
              </option>
            ))}
          </select>
        </label>

        <label>
          Status
          <select
            onChange={(e) =>
              props.onFilterChange({
                ...props.filters,
                status: e.target.value ? (e.target.value as FindingStatus) : undefined
              })
            }
            value={props.filters.status ?? ""}
          >
            <option value="">All statuses</option>
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {formatFindingValue(s)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {props.loading ? <LoadingState compact label="Loading findings" /> : null}
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

// ---------------------------------------------------------------------------
// Finding detail page
// ---------------------------------------------------------------------------

function FindingDetailsPage(props: {
  activityLog: ActivityEntry[];
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
          ← Back to findings
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
    <section aria-labelledby="finding-detail-title" className="detail-panel">
      <button className="text-action" onClick={props.onBack} type="button">
        ← Back to findings
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
            <EmptyState body="Risk score factors are not available." compact title="No factors" />
          )}
        </Panel>

        <Panel title="Update status">
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
          {props.updating ? <p className="muted-text">Updating…</p> : null}
          {props.statusUpdateError ? <p className="inline-error">{props.statusUpdateError}</p> : null}
        </Panel>

        <Panel title="Activity log">
          <ActivityLog entries={props.activityLog} />
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

// ---------------------------------------------------------------------------
// Connect account modal
// ---------------------------------------------------------------------------

function ConnectAccountModal(props: {
  error: string | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (data: ConnectAccountFormData) => Promise<void>;
}): ReactElement {
  const [name, setName] = useState("");
  const [externalAccountId, setExternalAccountId] = useState("");
  const [roleArn, setRoleArn] = useState("");
  const [externalId] = useState(() => `cloudguardx-${Math.random().toString(36).slice(2, 18)}`);
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void props.onSubmit({ name, externalAccountId, roleArn, externalId });
  }

  return (
    <div className="modal-overlay" onClick={props.onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect AWS Account</h2>
          <button aria-label="Close" className="modal-close" onClick={props.onClose} type="button">
            ✕
          </button>
        </div>

        <p className="modal-desc">
          Provide the read-only IAM role details for CloudGuardX to scan your AWS account. No write permissions are
          required.
        </p>

        <form className="modal-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Account name
            <input
              className="field-input"
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production AWS"
              ref={firstFieldRef}
              required
              type="text"
              value={name}
            />
          </label>

          <label className="field-label">
            AWS Account ID
            <input
              className="field-input"
              maxLength={12}
              minLength={12}
              onChange={(e) => setExternalAccountId(e.target.value.replace(/\D/g, ""))}
              pattern="\d{12}"
              placeholder="123456789012"
              required
              type="text"
              value={externalAccountId}
            />
          </label>

          <label className="field-label">
            IAM Role ARN
            <input
              className="field-input"
              onChange={(e) => setRoleArn(e.target.value)}
              placeholder="arn:aws:iam::123456789012:role/CloudGuardXReadOnly"
              required
              type="text"
              value={roleArn}
            />
          </label>

          <label className="field-label">
            External ID
            <input className="field-input" readOnly type="text" value={externalId} />
            <span className="field-hint">Auto-generated. Add this to your IAM role's trust policy.</span>
          </label>

          {props.error ? <p className="login-error" role="alert">{props.error}</p> : null}

          <div className="modal-actions">
            <button className="secondary-action" onClick={props.onClose} type="button">
              Cancel
            </button>
            <button className="primary-action" disabled={props.loading} type="submit">
              {props.loading ? "Connecting…" : "Connect account"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Severity chart (pure SVG, no dependencies)
// ---------------------------------------------------------------------------

function SeverityChart({ findings }: { findings: FindingSummary[] }): ReactElement {
  const openFindings = findings.filter((f) => f.status !== FindingStatus.Resolved);

  if (openFindings.length === 0) {
    return <EmptyState body="All findings are resolved or no scans have run." compact title="No open findings" />;
  }

  const bars = SEVERITY_BARS.map((bar) => ({
    ...bar,
    count: openFindings.filter((f) => f.severity === bar.severity).length
  }));

  const maxCount = Math.max(...bars.map((b) => b.count), 1);
  const BAR_W = 36;
  const GAP = 18;
  const H = 96;
  const W = bars.length * (BAR_W + GAP) - GAP;

  return (
    <div className="severity-chart">
      <svg aria-label="Open findings by severity" viewBox={`-4 -16 ${W + 8} ${H + 40}`}>
        {bars.map((bar, i) => {
          const barH = Math.max((bar.count / maxCount) * H, bar.count > 0 ? 3 : 0);
          const x = i * (BAR_W + GAP);
          const y = H - barH;
          return (
            <g key={bar.severity}>
              {bar.count > 0 ? (
                <text dominantBaseline="auto" fill={bar.color} fontSize="11" fontWeight="700" textAnchor="middle" x={x + BAR_W / 2} y={y - 4}>
                  {bar.count}
                </text>
              ) : null}
              <rect
                fill={bar.count > 0 ? bar.color : "#e6eaf0"}
                height={bar.count > 0 ? barH : 2}
                rx={4}
                width={BAR_W}
                x={x}
                y={bar.count > 0 ? y : H}
              />
              <text dominantBaseline="hanging" fill="#667085" fontSize="10" textAnchor="middle" x={x + BAR_W / 2} y={H + 8}>
                {bar.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Activity log
// ---------------------------------------------------------------------------

function ActivityLog({ entries }: { entries: ActivityEntry[] }): ReactElement {
  if (entries.length === 0) {
    return <EmptyState body="Status changes will appear here." compact title="No activity yet" />;
  }

  return (
    <div className="activity-log">
      {entries.map((entry) => (
        <div className="activity-entry" key={entry.id}>
          <StatusBadge status={entry.status} />
          <span className="activity-label">{entry.label}</span>
          <span className="muted-text activity-time">{formatDate(entry.timestamp)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader (shown while posture data loads)
// ---------------------------------------------------------------------------

function SkeletonDashboard(): ReactElement {
  return (
    <>
      <section aria-hidden="true" aria-label="Loading" className="summary-grid">
        {Array.from({ length: 5 }).map((_, i) => (
          <article className="metric-card neutral" key={i}>
            <span className="skeleton skeleton-label" />
            <strong className="skeleton skeleton-value" />
          </article>
        ))}
      </section>
      <section aria-hidden="true" className="dashboard-grid">
        {Array.from({ length: 4 }).map((_, i) => (
          <div className="panel skeleton-panel" key={i}>
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-row" />
            <div className="skeleton skeleton-row short" />
            <div className="skeleton skeleton-row" />
          </div>
        ))}
      </section>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared components
// ---------------------------------------------------------------------------

function FindingTable(props: { findings: FindingSummary[]; onFindingOpen: (findingId: string) => void }): ReactElement {
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

function FindingList(props: { findings: FindingSummary[]; onFindingOpen: (findingId: string) => void }): ReactElement {
  return (
    <div className="finding-list">
      {props.findings.map((finding) => (
        <button
          className="finding-list-row"
          key={finding.id}
          onClick={() => props.onFindingOpen(finding.id)}
          type="button"
        >
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
    <section aria-label={title} className="panel">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function LoadingState({ compact = false, label }: { compact?: boolean; label: string }): ReactElement {
  return (
    <div className={compact ? "state-block compact" : "state-block"} role="status">
      <span aria-hidden="true" className="spinner" />
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

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function metricsFrom(data: PostureData): ReadonlyArray<{ label: string; value: string; tone: string }> {
  const openFindings = data.findings.filter((f) => f.status !== FindingStatus.Resolved);
  const criticalFindings = openFindings.filter((f) => f.severity === FindingSeverity.Critical);
  const maxRiskScore = openFindings.reduce((max, f) => Math.max(max, f.score), 0);

  return [
    { label: "Cloud accounts", value: String(data.cloudAccounts.length), tone: "neutral" },
    { label: "Assets", value: String(data.assets.length), tone: "neutral" },
    { label: "Open findings", value: String(openFindings.length), tone: "risk" },
    { label: "Critical findings", value: String(criticalFindings.length), tone: "critical" },
    { label: "Max risk score", value: String(Math.round(maxRiskScore)), tone: "score" }
  ];
}

function replaceFinding(findings: FindingSummary[], updated: FindingSummary): FindingSummary[] {
  return findings.map((f) => (f.id === updated.id ? updated : f));
}

function matchesFindingFilters(finding: FindingSummary, filters: FindingFilters): boolean {
  return (!filters.severity || finding.severity === filters.severity) && (!filters.status || finding.status === filters.status);
}

function routeIsActive(current: AppRoute, target: AppRoute): boolean {
  if (current.view === "finding" && target.view === "findings") return true;
  return current.view === target.view;
}

function routeFromHash(hash: string): AppRoute {
  const normalized = hash.replace(/^#\/?/, "");
  const [view, findingId] = normalized.split("/");

  if (view === "cloud-accounts") return { view: "cloud-accounts" };
  if (view === "assets") return { view: "assets" };
  if (view === "findings" && findingId) return { view: "finding", findingId };
  if (view === "findings") return { view: "findings" };
  return { view: "overview" };
}

function hashFromRoute(route: AppRoute): string {
  if (route.view === "finding" && route.findingId) return `#/findings/${route.findingId}`;
  if (route.view === "cloud-accounts") return "#/cloud-accounts";
  if (route.view === "assets") return "#/assets";
  if (route.view === "findings") return "#/findings";
  return "#/overview";
}

function pageTitle(route: AppRoute): string {
  if (route.view === "cloud-accounts") return "Cloud Accounts";
  if (route.view === "assets") return "Assets";
  if (route.view === "findings") return "Findings";
  if (route.view === "finding") return "Finding details";
  return "Overview";
}

function countAssetsByType(assets: AssetSummary[]): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>();
  for (const asset of assets) {
    counts.set(asset.resourceType, (counts.get(asset.resourceType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type));
}

function formatResourceType(value: string): string {
  return value
    .split("_")
    .map((part) =>
      /^(aws|s3|ec2|iam|rds|ecr|kms)$/i.test(part)
        ? part.toUpperCase()
        : part.charAt(0).toUpperCase() + part.slice(1)
    )
    .join(" ");
}

function formatFindingValue(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatFactorName(value: string): string {
  return value.replace(/[A-Z]/g, (l) => ` ${l.toLowerCase()}`).replace(/^./, (l) => l.toUpperCase());
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}
