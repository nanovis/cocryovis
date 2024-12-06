#!/bin/bash

# Set a default value if no argument is provided
API_URL="${1:-}"

# Set the environment variable
export REACT_APP_API_URL="$API_URL"

# Run the build command
cd client && npm install --include=dev && npm run build