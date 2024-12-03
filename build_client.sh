#!/bin/bash

# Set a default value if no argument is provided
API_URL="${1:-http://localhost:8080}"

# Extract the protocol (http or https)
PROTOCOL=$(echo "$API_URL" | sed -n 's/^\(http\|https\):\/\/.*/\1/p')

# Remove the http:// or https:// prefix for WebSocket URL
WS_URL=$(echo "$API_URL" | sed 's/^https\?:\/\///')

# Set the WebSocket protocol based on the provided API URL protocol
if [ "$PROTOCOL" == "https" ]; then
  export REACT_APP_WS_URL="wss://$WS_URL"
else
  export REACT_APP_WS_URL="ws://$WS_URL"
fi

# Set the environment variable
export REACT_APP_API_URL="$API_URL"

# Run the build command
cd client && npm install --include=dev && npm run build