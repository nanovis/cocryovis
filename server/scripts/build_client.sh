#!/bin/bash
set -e

# Set script root to its directory
cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit

API_URL=""
OUTPUT_DIR=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --api-url)
      API_URL="$2"
      shift 2
      ;;
    --outDir)
      OUTPUT_DIR="$2"
      shift 2
      ;;
    *)
      # Legacy positional argument support
      if [ -z "$API_URL" ]; then
        API_URL="$1"
      elif [ -z "$OUTPUT_DIR" ]; then
        OUTPUT_DIR="$1"
      fi
      shift
      ;;
  esac
done

export VITE_API_URL="$API_URL"

cd ../../client
npm install --include=dev

BUILD_OPTS=""
if [ -n "$OUTPUT_DIR" ]; then
  BUILD_OPTS="--outDir $OUTPUT_DIR"
fi

npm run build $BUILD_OPTS