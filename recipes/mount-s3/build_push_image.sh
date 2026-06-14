#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE="${ISLO_MOUNT_S3_IMAGE:-ghcr.io/islo-labs/islo-runner-mount-s3:latest}"
PLATFORM="${DOCKER_PLATFORM:-linux/amd64}"
SKIP_SMOKE="${SKIP_SMOKE:-0}"
PUSH_IMAGE="${PUSH_IMAGE:-1}"

echo "Building ${IMAGE} for ${PLATFORM}"
docker build --progress=plain --platform "${PLATFORM}" -t "${IMAGE}" "${HERE}"

if [ "${SKIP_SMOKE}" != "1" ]; then
  echo "Verifying mount-s3 is installed"
  docker run --rm --platform "${PLATFORM}" "${IMAGE}" mount-s3 --version
fi

if [ "${PUSH_IMAGE}" = "1" ]; then
  echo "Pushing ${IMAGE}"
  docker push "${IMAGE}"
fi
