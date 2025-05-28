#!/bin/bash
set -euo pipefail

# Define the submodule scripts
SUBMODULES=(
  "./scripts/build_gctffind.sh"
  "./scripts/install_ilastik.sh"
  "./scripts/install_imod.sh"
  "./scripts/build_proximalCryoET.sh"
)

for script in "${SUBMODULES[@]}"; do
  echo "Running '$script'..."
  if [[ ! -x "$script" ]]; then
    echo "Warning: '$script' not executable or missing; running with bash."
    bash "$script"
  else
    "$script"
  fi
  echo "'$script' completed successfully."
done

echo "All submodules installed successfully."