#!/bin/bash
set -e

API_URL="${1:-}"

export VITE_API_URL="$API_URL"

cd client
npm install --include=dev
npm run build