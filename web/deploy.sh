#!/usr/bin/env bash
# Build web/ and publish it to AWS Amplify Hosting (manual deploy, no Git connection needed).
# First run creates the Amplify app "vachan" with an SPA rewrite; later runs reuse it.
set -euo pipefail
cd "$(dirname "$0")"
REGION=ap-south-1 APP=vachan BRANCH=main

npm run build
APP_ID=$(aws amplify list-apps --region $REGION --query "apps[?name=='$APP'].appId | [0]" --output text)
if [ "$APP_ID" = "None" ]; then
  APP_ID=$(aws amplify create-app --region $REGION --name $APP --platform WEB \
    --custom-rules '[{"source":"</^[^.]+$|\\.(?!(css|gif|ico|jpg|jpeg|js|png|txt|svg|woff|woff2|ttf|map|json|webp|webmanifest)$)([^.]+$)/>","target":"/index.html","status":"200"}]' \
    --query app.appId --output text)
  aws amplify create-branch --region $REGION --app-id "$APP_ID" --branch-name $BRANCH --stage PRODUCTION >/dev/null
fi

(cd dist && rm -f ../site.zip && zip -qr ../site.zip .)
read -r JOB URL < <(aws amplify create-deployment --region $REGION --app-id "$APP_ID" --branch-name $BRANCH \
  --query '[jobId, zipUploadUrl]' --output text)
curl -sf -X PUT -H "Content-Type: application/zip" --upload-file site.zip "$URL"
aws amplify start-deployment --region $REGION --app-id "$APP_ID" --branch-name $BRANCH --job-id "$JOB" >/dev/null
until s=$(aws amplify get-job --region $REGION --app-id "$APP_ID" --branch-name $BRANCH --job-id "$JOB" --query job.summary.status --output text) && [[ $s =~ SUCCEED|FAILED|CANCELLED ]]; do sleep 4; done
rm -f site.zip
echo "$s: https://$BRANCH.$APP_ID.amplifyapp.com"
