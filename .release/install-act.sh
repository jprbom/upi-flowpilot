#!/usr/bin/env bash
set -euo pipefail
version=v0.2.89
expected=0191d6f1f3b716b5c55820032605d05fc3c1cdbf581ebeff655019e5dd1524c0
mkdir -p /tmp/release-act
curl --fail --show-error --location --retry 3 \
  "https://github.com/nektos/act/releases/download/$version/act_Linux_x86_64.tar.gz" \
  -o /tmp/release-act/act.tar.gz
echo "$expected  /tmp/release-act/act.tar.gz" | sha256sum --check -
tar -xzf /tmp/release-act/act.tar.gz -C /tmp/release-act act
install /tmp/release-act/act /usr/local/bin/act
