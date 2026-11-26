# AUR packaging

This directory maintains the `c3code-bin` and `c3code-nightly-bin` AUR packages. Both repackage
the x86_64 and ARM64 AppImages from C3 Code's GitHub Releases. They install as `c3code` beside
T3 Code's `t3code-bin`, and neither provides nor conflicts with it. Neither package is on the AUR
yet: publishing needs the AUR accounts and the `AUR_SSH_PRIVATE_KEY` secret.

## Publishing

The release workflow calls `.github/workflows/publish-aur.yml` after publishing a GitHub release;
the workflow can also be run manually for a specific tag. It selects the stable or nightly
package, then updates its version and both architectures' asset names and checksums, builds it
for the host architecture, regenerates `.SRCINFO`, and pushes it to the AUR.

To validate a release on Arch Linux:

```bash
sudo pacman -Syu --needed base-devel github-cli jq namcap
GH_TOKEN=$(gh auth token) RELEASE_TAG=v0.1.7 \
  packaging/aur/scripts/release.sh
```
