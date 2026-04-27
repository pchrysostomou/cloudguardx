#!/usr/bin/env bash
set -euo pipefail

ACCOUNT_ID="000000000000"
ROLE_NAME="CloudGuardXReadOnly"

awslocal iam create-role \
  --role-name "${ROLE_NAME}" \
  --assume-role-policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [
      {
        \"Effect\": \"Allow\",
        \"Principal\": { \"AWS\": \"arn:aws:iam::${ACCOUNT_ID}:root\" },
        \"Action\": \"sts:AssumeRole\",
        \"Condition\": {
          \"StringEquals\": {
            \"sts:ExternalId\": \"cloudguardx-local-external-id\"
          }
        }
      }
    ]
  }" || true

awslocal iam attach-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-arn arn:aws:iam::aws:policy/ReadOnlyAccess || true
