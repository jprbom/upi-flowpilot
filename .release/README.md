# Release-only AWS qualification

GitHub stores source and reviewed branches. AWS CodeBuild runs Linux qualification on an explicit release command. There is no webhook and no build on ordinary pushes.

From a clean, pushed checkout with Python, Git, and authenticated AWS CLI:

```powershell
python .release/release.py plan
python .release/release.py test
python .release/release.py release
python .release/release.py rollback --receipt .release-local/<deployed-commit>.json
```

`test` qualifies a pushed commit without changing production. `release` requires origin/main ancestry and a configured production adapter. It qualifies first, then deploys. A failed build never deploys. Deployment adapters must serialize changes, verify health and restore the previous source on failure. A failed deployment remains failed even when rollback recovers health. Stale rollback receipts must not overwrite newer releases.

The initial TradeOn adapter supports Python source-only backend changes. Dependency, native binary, schema, service configuration and dashboard changes are blocked before source mutation. It refuses active-market deployments. Operator configuration, databases, model artifacts and untracked state stay intact. It never migrates schemas, starts trading lanes, promotes models or rewrites credentials. Backend deployment does not qualify iOS signing, TestFlight distribution or an App Store release.

Existing Linux test definitions execute on CodeBuild using a pinned nektos/act binary and a digest-pinned Ubuntu image. Exact Git objects and tracked files are packaged locally; no untracked data, local credentials or datasets are included. Only GitHub checkout/cache/artifact transport is replaced. Test commands, service containers, matrices, coverage policy and security gates are preserved. CodeBuild artifacts retain logs and declared evidence. This compatibility layer needs actual CodeBuild acceptance; syntax/unit checks alone do not establish application qualification.

The build role can read its project source, write its evidence and append build logs. It cannot deploy or read production secrets. The operator uses AWS CLI credentials for deployment over SSM. No long-lived AWS keys are stored in the repository.

Bounds: one concurrent build/project, 120-minute execution timeout, 15-minute queue timeout, medium Linux compute, no persistent runner/cache, 14-day logs and 90-day artifacts. AWS charges for compute, artifacts, logs and existing hosting still apply.

Provision/update: `python .release/provision.py`. It creates no build or webhook. The smoke buildspec verifies infrastructure and synthetic rollback fixtures; it is explicitly not application qualification. `plan` shows the repository-specific check scope and deployment readiness. An absent deployment adapter blocks `release` and `rollback` rather than inventing a production target.

Native macOS/Windows signing, credentialed security publication, production operations and scheduled monitoring require separate adapters. Preserve these workflows until equivalent controls are accepted. Never disable a required GitHub check without migrating its gate. Read the repository rollout document for actual acceptance and remaining work.
