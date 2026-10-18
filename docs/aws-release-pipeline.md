# Release-only AWS pipeline

Prepared on 18 October 2026. GitHub keeps source/version history; CodeBuild is explicitly started for release checks. No new hosting stack is created.

Commands: `python .release/release.py plan`, `python .release/release.py test`, and `python .release/release.py release`. Artifact-only mode produces qualification evidence and never claims a production deployment. For accepted production adapters, `release` tests then deploys with health recovery; `rollback --receipt .release-local/<sha>.json` rejects stale targets.

Project: `release-upi-flowpilot` in `ap-south-1`. No webhook. One concurrent build, 120-minute timeout, project-scoped artifact/log permissions. No persistent runner. See [.release/README.md](../.release/README.md).

## Proposed cutover

This branch makes the following workflows manual-only, preserving their job bodies as an operator fallback:


Main is unchanged while the PR is a draft. Do not merge pending migrations before their replacement checks are accepted. Existing required review/status rules are preserved.

## Qualification scope

- `.release/checks/verify.yml`

## Deployment readiness

Mode: `artifact-only`. Builds/checks only. No production host or binary distribution is asserted.

Validation: portable workflow definitions parse; release-control, package transport and cloud rollback negative tests pass locally. This is not evidence that every application suite, native build or production adapter has passed on AWS. Per-repository CodeBuild acceptance is still required.
