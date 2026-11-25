#!/usr/bin/env bash
# ==============================================================================
# submit.sh - Safe Verification & Submission Placeholder Script
# ==============================================================================
# IMPORTANT NOTICE:
# If your course/academy provides an official, pre-installed grading script
# (for example: /usr/local/bin/submit.sh or a script provided in the lab environment),
# you MUST run THAT script for automated grading.
#
# This script is a safe verification placeholder that confirms your local Git
# revision and container image state before submission.
# ==============================================================================

set -euo pipefail

echo "============================================================"
echo "      Game Foundation - Pre-Submission Evidence Check       "
echo "============================================================"

# 1. Check Git Status & Revision
if command -v git &> /dev/null; then
    echo "[+] Git Status:"
    git status -s || true
    echo ""
    echo "[+] Current Git Commit (HEAD):"
    CURRENT_REV=$(git rev-parse HEAD 2>/dev/null || echo "No commit yet")
    echo "    $CURRENT_REV"
else
    echo "[-] Git is not installed or not in PATH."
fi
echo ""

# 2. Check Container Runtime & Image ID
if command -v podman &> /dev/null; then
    echo "[+] Podman Images for 'game-foundation':"
    podman images | grep "game-foundation" || echo "    No 'game-foundation' images found in Podman."
elif command -v docker &> /dev/null; then
    echo "[+] Docker Images for 'game-foundation':"
    docker images | grep "game-foundation" || echo "    No 'game-foundation' images found in Docker."
else
    echo "[i] Neither podman nor docker found in current PATH."
fi
echo ""

# 3. Environment Variables Check
echo "[+] Environment Variable Placeholders:"
echo "    P1_NAMESPACE : ${P1_NAMESPACE:-'(not set - replace with classroom namespace)'}"
echo "    P1_REVISION  : ${P1_REVISION:-'(not set - set to your git commit hash)'}"
echo ""

echo "============================================================"
echo "Ready to submit! If your lab environment provides an official"
echo "submission utility, invoke it now according to lab guidelines."
echo "============================================================"
