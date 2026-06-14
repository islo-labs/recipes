#!/bin/sh
set -e

S3_MOUNT_PATH="${S3_MOUNT_PATH:-/mnt/s3}"
[ -z "$S3_BUCKET" ] && exit 0

# Invoke after computer creation. Gateway/IAM credentials are not available
# early enough for image entrypoints to mount reliably.
mkdir -p "$S3_MOUNT_PATH"
mount-s3 "$S3_BUCKET" "$S3_MOUNT_PATH" \
  --region "${AWS_REGION:-${AWS_DEFAULT_REGION:-us-east-1}}" \
  --allow-overwrite \
  --allow-delete \
  --allow-other \
  --uid "$(id -u islo 2>/dev/null || id -u)" \
  --gid "$(id -g islo 2>/dev/null || id -g)"
