#!/bin/bash
set -euo pipefail

# Set script root to its directory
cd -- "$(dirname -- "${BASH_SOURCE[0]}")" || exit

# Define the submodule scripts
SUBMODULES=(
  "./build_motioncor3.sh"
  "./build_gctffind.sh"
  "./install_ilastik.sh"
  "./install_imod.sh"
  "./build_proximalCryoET.sh"
)

# Parse command-line arguments for --skip flags
# Usage: ./install_submodules.sh --skip build_proximalCryoET --skip install_ilastik
# Or: ./install_submodules.sh --skip "build_proximalCryoET,install_ilastik"
declare -A SKIP_MAP
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip)
      if [[ $# -lt 2 ]]; then
        echo "Error: --skip requires an argument"
        exit 1
      fi
      shift
      # Handle comma-separated list or single module
      IFS=',' read -ra SKIP_ARRAY <<< "$1"
      for skip in "${SKIP_ARRAY[@]}"; do
        SKIP_MAP["${skip// /}"]="1"
      done
      shift
      ;;
    *)
      echo "Error: unknown argument '$1'"
      exit 1
      ;;
  esac
done

for script in "${SUBMODULES[@]}"; do
  # Extract the base name for comparison (e.g., "build_proximalCryoET" from "./scripts/build_proximalCryoET.sh")
  basename_no_ext="${script##*/}"
  basename_no_ext="${basename_no_ext%.sh}"
  
  # Check if this submodule should be skipped
  if [[ -n "${SKIP_MAP[$basename_no_ext]:-}" ]] || [[ -n "${SKIP_MAP[$script]:-}" ]]; then
    echo "Skipping '$script' (--skip flag)."
    continue
  fi
  
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