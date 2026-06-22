#!/usr/bin/env bash
# Bulk-creates GitHub issues from docs/github_issues.md.
#
# Requires: `gh` CLI installed and authenticated (`gh auth login`), and run
# from inside the target repo (or pass --repo owner/name).
#
# Safe to re-run: before creating each issue, it checks for an existing
# open OR closed issue with the exact same title and skips it, so editing
# docs/github_issues.md and re-running won't create duplicates.
#
# Usage:
#   ./scripts/create_github_issues.sh [--repo owner/name] [--dry-run]

set -euo pipefail

REPO_ARG=()
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --repo)
      shift_next_is_repo=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
  esac
done

# Simple manual parse of --repo VALUE (kept dependency-free, no getopts edge cases needed for 2 flags).
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)
      REPO_ARG=(--repo "$2")
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      shift
      ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ISSUES_FILE="$SCRIPT_DIR/../docs/github_issues.md"

if ! command -v gh &> /dev/null; then
  echo "Error: GitHub CLI ('gh') is not installed. See https://cli.github.com/" >&2
  exit 1
fi

if [[ "$DRY_RUN" == false ]]; then
  gh auth status "${REPO_ARG[@]}" &> /dev/null || {
    echo "Error: gh is not authenticated. Run 'gh auth login' first." >&2
    exit 1
  }
fi

# Split the issues file into per-issue chunks on the delimiter line.
csplit -s -z -f "$SCRIPT_DIR/.issue_chunk_" -b "%03d.md" "$ISSUES_FILE" '/^---ISSUE-END---$/' '{*}' 2>/dev/null || true

created=0
skipped=0

for chunk in "$SCRIPT_DIR"/.issue_chunk_*.md; do
  [[ -f "$chunk" ]] || continue

  title=$(grep -m1 '^### ' "$chunk" | sed 's/^### //') || true
  [[ -z "${title:-}" ]] && { rm -f "$chunk"; continue; }

  labels=$(grep -m1 '^LABELS: ' "$chunk" | sed 's/^LABELS: //') || true
  milestone=$(grep -m1 '^MILESTONE: ' "$chunk" | sed 's/^MILESTONE: //') || true
  body=$(sed -n '/^BODY:$/,$p' "$chunk" | tail -n +2 | sed '/^---ISSUE-END---$/d')

  echo "---"
  echo "Title:     $title"
  echo "Labels:    $labels"
  echo "Milestone: $milestone"

  if [[ "$DRY_RUN" == true ]]; then
    echo "(dry-run, not creating)"
    rm -f "$chunk"
    continue
  fi

  existing=$(gh issue list "${REPO_ARG[@]}" --state all --search "in:title \"$title\"" --json title --jq ".[] | select(.title == \"$title\") | .title" 2>/dev/null || true)
  if [[ -n "$existing" ]]; then
    echo "Skipping — issue with this exact title already exists."
    skipped=$((skipped + 1))
    rm -f "$chunk"
    continue
  fi

  label_args=()
  if [[ -n "$labels" ]]; then
    IFS=',' read -ra label_list <<< "$labels"
    for l in "${label_list[@]}"; do
      label_args+=(--label "$(echo "$l" | xargs)")
    done
  fi

  gh issue create "${REPO_ARG[@]}" \
    --title "$title" \
    --body "$body" \
    "${label_args[@]}" \
    || echo "Warning: failed to create issue '$title' (label/milestone may not exist yet in the repo — create labels/milestones first, or re-run without --label args)."

  created=$((created + 1))
  rm -f "$chunk"
done

rm -f "$SCRIPT_DIR"/.issue_chunk_*.md

echo "---"
echo "Done. Created: $created, Skipped (duplicates): $skipped"
echo "Note: milestones aren't auto-created by this script (gh has no 'milestone create' for repos without one yet)."
echo "Create milestones first via: gh api repos/{owner}/{repo}/milestones -f title='Phase 1 — Engine Core'"
