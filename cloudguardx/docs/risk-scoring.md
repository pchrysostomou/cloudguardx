# Risk Scoring Model

Risk scores use a 0 to 100 scale.

Inputs:

- internet exposure
- privilege level
- exploitability
- blast radius
- asset sensitivity
- known CVEs
- tenant-defined criticality
- compliance impact
- credential or secret exposure

Severity mapping:

- 90-100: critical
- 70-89: high
- 40-69: medium
- 10-39: low
- 0-9: informational

The final scoring algorithm is implemented in the `@cloudguardx/risk-engine` package in Phase 4. The schema already stores raw factors to preserve auditability and explainability.

