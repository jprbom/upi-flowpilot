#!/usr/bin/env bash
# Native bootstrap on the ephemeral AWS runner; no GitHub token/OIDC required.
set -euo pipefail
compiler="${RELEASE_OCAML_COMPILER:?compiler version is required}"
[[ "$compiler" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || exit 2
export OPAMROOT="${RUNNER_TEMP:?}/release-opam"
export OPAMROOTISOK=1
export OPAMJOBS=2
sudo apt-get update -qq
sudo apt-get install -y --no-install-recommends opam build-essential pkg-config m4 \
  libgmp-dev libssl-dev libffi-dev rsync unzip bubblewrap
opam init --bare --yes --disable-sandboxing default https://opam.ocaml.org
opam switch create release "ocaml-base-compiler.$compiler" --yes
opam switch set release
{
  echo "OPAMROOT=$OPAMROOT"
  echo 'OPAMROOTISOK=1'
  echo 'OPAMJOBS=2'
} >> "$GITHUB_ENV"
opam exec -- ocamlc -version
