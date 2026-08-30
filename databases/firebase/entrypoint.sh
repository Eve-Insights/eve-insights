#!/bin/sh
# Start the emulator suite, importing previously exported state when there is any.
# `--import` fails outright on a missing/empty directory, so it is opt-in per run.
set -eu

DATA_DIR="${FIREBASE_DATA_DIR:-/srv/firebase/data}"
PROJECT="${FIREBASE_PROJECT_ID:-eve-insights}"

set -- emulators:start --project "$PROJECT" --export-on-exit "$DATA_DIR"

if [ -f "$DATA_DIR/firebase-export-metadata.json" ]; then
  set -- "$@" --import "$DATA_DIR"
else
  echo "no export found in $DATA_DIR — starting with empty emulators"
fi

exec firebase "$@"
