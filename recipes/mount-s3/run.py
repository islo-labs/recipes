#!/usr/bin/env python3
"""Mount an S3 bucket on an Islo computer using a custom image and gateway cloud role."""

from __future__ import annotations

import json
import os
import sys
import uuid

from recipekit.computer import client_from_env, delete_computer, must_exec

RECIPE_ID = "mount-s3"
GATEWAY_NAME = "recipes-s3-rw"
MOUNT_DIR = "/tmp/s3"

ROLE_ARN = os.environ["AWS_ROLE_ARN"]
BUCKET = os.environ["S3_BUCKET"]
REGION = os.environ.get("AWS_REGION", "us-east-1")
IMAGE = os.environ.get("ISLO_MOUNT_S3_IMAGE", "ghcr.io/islo-labs/islo-runner-mount-s3:latest")
IAM_READY = os.environ.get("ISLO_IAM_READY", "").lower() in {"1", "true", "yes"}


def print_trust_policy(external_id: str) -> None:
    snippet = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {"AWS": "<ISLO_STS_PRINCIPAL_FROM_DASHBOARD>"},
                "Action": "sts:AssumeRole",
                "Condition": {"StringEquals": {"sts:ExternalId": external_id}},
            }
        ],
    }
    print("\n--- IAM trust policy snippet ---")
    print(json.dumps(snippet, indent=2))
    print("--- end snippet ---\n")
    print("Set the trust policy on your AWS IAM role, then continue.")


def ensure_cloud_role(client):
    for role in client.cloud_roles.list_cloud_roles():
        if role.role_arn == ROLE_ARN:
            print(f"Reusing cloud role id={role.id} arn={role.role_arn}")
            return role

    role = client.cloud_roles.create_cloud_role(provider="aws", role_arn=ROLE_ARN)
    print(f"Created cloud role id={role.id} arn={role.role_arn}")
    print(f"External ID: {role.external_id}")
    print_trust_policy(role.external_id)
    if not IAM_READY:
        input("Press Enter after updating the IAM trust policy...")
    return role


def ensure_gateway(client, cloud_role):
    existing = next(
        (g for g in client.gateway_profiles.list_gateway_profiles() if g.name == GATEWAY_NAME),
        None,
    )
    if existing:
        if not existing.cloud_role or existing.cloud_role.id != cloud_role.id:
            updated = client.gateway_profiles.update_gateway_profile(
                profile_id=existing.id,
                cloud_role=cloud_role.id,
            )
            print(f"Updated gateway profile id={updated.id}")
            return updated
        print(f"Reusing gateway profile name={existing.name} id={existing.id}")
        return existing

    created = client.gateway_profiles.create_gateway_profile(
        name=GATEWAY_NAME,
        internet_enabled=True,
        cloud_role=cloud_role.id,
    )
    print(f"Created gateway profile name={created.name} id={created.id}")
    return created


def main() -> int:
    from recipekit.computer import load_recipe_env

    load_recipe_env()
    client = client_from_env()
    role = ensure_cloud_role(client)
    gateway = ensure_gateway(client, role)
    computer_name = f"recipes-s3-{uuid.uuid4().hex[:8]}"

    print(
        f"Creating computer {computer_name!r} with image {IMAGE!r} "
        f"and gateway_profile={gateway.name!r}"
    )
    client.sandboxes.create_sandbox(
        name=computer_name,
        image=IMAGE,
        gateway_profile=gateway.name,
        env={
            "S3_BUCKET": BUCKET,
            "AWS_REGION": REGION,
            "S3_MOUNT_PATH": MOUNT_DIR,
        },
        request_options={"max_retries": 0},
    )

    try:
        from recipekit.computer import wait_ready

        wait_ready(client, computer_name, timeout=180)
        must_exec(client, computer_name, "mount-s3 --version", timeout=60)
        must_exec(
            client,
            computer_name,
            "sudo -E env "
            'HOME="$HOME" '
            'S3_BUCKET="$S3_BUCKET" '
            'AWS_REGION="$AWS_REGION" '
            'S3_MOUNT_PATH="$S3_MOUNT_PATH" '
            "/usr/local/bin/mount-s3.sh",
            timeout=180,
        )
        must_exec(
            client,
            computer_name,
            f"bash -lc 'echo hello > {MOUNT_DIR}/test.txt && cat {MOUNT_DIR}/test.txt && rm {MOUNT_DIR}/test.txt'",
            timeout=60,
        )
        print(f"PASS: {RECIPE_ID}")
        return 0
    finally:
        delete_computer(client, computer_name)


if __name__ == "__main__":
    sys.exit(main())
