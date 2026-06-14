# syntax=docker/dockerfile:1.7
# Custom computer image with AWS Mountpoint for S3 preinstalled.

ARG BASE_IMAGE=ghcr.io/islo-labs/islo-runner:latest
FROM ${BASE_IMAGE}

ENV DEBIAN_FRONTEND=noninteractive

USER root

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fuse3 \
    && curl -fsSL -o /tmp/mount-s3.deb \
        https://s3.amazonaws.com/mountpoint-s3-release/latest/x86_64/mount-s3.deb \
    && apt-get install -y --no-install-recommends /tmp/mount-s3.deb \
    && rm -f /tmp/mount-s3.deb \
    && if ! grep -qs '^user_allow_other' /etc/fuse.conf; then \
        echo 'user_allow_other' >> /etc/fuse.conf; \
    fi \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

COPY mount-s3.sh /usr/local/bin/mount-s3.sh
RUN chmod +x /usr/local/bin/mount-s3.sh
