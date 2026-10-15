#!/usr/bin/env bash
# Deploy Growvia to Google Cloud Run (Tokyo, next to Supabase). Run from the repo root in Cloud Shell:
#   bash deploy/cloudrun.sh
set -euo pipefail
PROJECT="${PROJECT:-growvia-510109}"
REGION="${REGION:-asia-northeast1}"
SERVICE="${SERVICE:-growvia}"

[ -f deploy/env.yaml ] || { echo "deploy/env.yaml is missing — copy deploy/env.example.yaml and fill it in."; exit 1; }
# Drop empty values so they don't override anything.
grep -vE '^\s*#|:\s*""\s*$|^\s*$' deploy/env.yaml > /tmp/growvia-env.yaml

gcloud config set project "$PROJECT" >/dev/null
gcloud run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --port 8080 \
  --cpu 1 --memory 1Gi \
  --concurrency 40 \
  --timeout 300 \
  --min-instances 0 --max-instances 3 \
  --cpu-boost \
  --env-vars-file /tmp/growvia-env.yaml

URL=$(gcloud run services describe "$SERVICE" --region "$REGION" --format 'value(status.url)')
echo
echo "Deployed: $URL"
echo "Health:   $URL/api/health"
