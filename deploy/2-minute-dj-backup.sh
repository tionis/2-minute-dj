#!/bin/sh
set -eu

backup_dir="${BACKUP_DIR:-${HOME}/.local/state/2-minute-dj/backups}"
mkdir -p "$backup_dir"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
temporary="${backup_dir}/.${stamp}.tar.tmp"
target="${backup_dir}/${stamp}.tar"

podman volume export 2-minute-dj-data --output "$temporary"
mv "$temporary" "$target"
find "$backup_dir" -type f -name '*.tar' -mtime +14 -delete
