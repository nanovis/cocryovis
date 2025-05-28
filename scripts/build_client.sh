#!/bin/bash
set -e

API_URL="${1:-}"

export REACT_APP_API_URL="$API_URL"

cd client
npm install --include=dev
npm run build