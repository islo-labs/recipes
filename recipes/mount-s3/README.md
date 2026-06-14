# Mount S3 on a computer

Mount an AWS S3 bucket on an Islo computer using a custom image with Mountpoint for S3, a gateway profile, and an AWS cloud role.

## Goal

Register an AWS IAM role with Islo, attach it to a gateway profile, start a computer from a custom image, mount a bucket, and round-trip a file.

## When to use

- Persistent object storage for agent workloads on Islo
- Custom computer images with preinstalled tools
- AWS access via gateway cloud roles (not long-lived keys in the computer)

## Prerequisites

- Islo account and API key (`islo>=0.3.1`)
- AWS account with an IAM role and S3 bucket
- Optional: Docker to build/push your own image tag

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ISLO_API_KEY` | Yes | API key from [app.islo.dev/api-keys](https://app.islo.dev/api-keys) |
| `AWS_ROLE_ARN` | Yes | IAM role ARN Islo will assume |
| `S3_BUCKET` | Yes | Bucket to mount |
| `AWS_REGION` | No | Region (default `us-east-1`) |
| `ISLO_MOUNT_S3_IMAGE` | No | Custom image (default `ghcr.io/islo-labs/islo-runner-mount-s3:latest`) |
| `ISLO_IAM_READY` | No | Set to `1` to skip interactive IAM pause (CI/agents) |

## Quick start

```bash
cd islo-recipes/recipes/mount-s3
uv sync
cp .env.example .env
# edit .env

uv run python run.py
```

On first run the script prints an **External ID** and trust-policy JSON. Update your IAM role trust policy, then press Enter (or set `ISLO_IAM_READY=1` if already configured).

### Build your own image (optional)

```bash
cd recipes/mount-s3
./build_push_image.sh
```

## Verify success

```
PASS: mount-s3
```

## How it works

1. Creates or reuses an AWS cloud role and gateway profile with that role attached.
2. Creates a computer (SDK: `create_sandbox`) from the mount-s3 image.
3. Runs `mount-s3.sh` **after** create — gateway IAM credentials are available only post-create, not at image entrypoint.
4. Writes and reads a test file under `/tmp/s3`.

## AWS IAM

Your role needs S3 permissions on the bucket (`s3:ListBucket`, `s3:GetObject`, `s3:PutObject`, `s3:DeleteObject`) and a trust policy allowing Islo's STS principal with the External ID from the script.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| AssumeRole fails | Trust policy External ID mismatch |
| Mount fails immediately | Ensure mount runs post-create, not in Dockerfile `ENTRYPOINT` |
| Image pull errors | Build/push your own tag with `build_push_image.sh` |

## Related recipes

- [`gateway-allowlist`](../gateway-allowlist/) — host egress rules (different gateway use case)
