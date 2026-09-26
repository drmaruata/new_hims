#!/usr/bin/env bash
# Shared helpers for the scripts in this directory. Sourced, not executed.
#
# Kept in one file because the Supabase Cloud rule is a correctness constraint,
# not a convenience: the platform records applied migration versions in
# `supabase_migrations.schema_migrations`, so a migration applied *outside* that
# ledger leaves the two out of step. Whichever script ran it, the next
# `supabase db push` would then believe the file was already applied and skip
# it. Handling the host in one place is what stops two scripts from disagreeing
# about whether a given target is a cloud project.

# Extract the host from a PostgreSQL connection URL.
#
# `postgresql://user:pass@host:5432/db?sslmode=require` -> `host`
#
# Hand-rolled rather than delegated to `jq`, because these scripts should need
# nothing beyond psql and a POSIX shell to run. Handles the two shapes that
# break a naive cut: a bracketed IPv6 literal (`[::1]:5432`, which is not the
# same as cutting at the first colon) and a URL with no userinfo.
pg_url_host() {
  local rest="${1#*://}"
  rest="${rest#*@}"

  case "$rest" in
    \[*\]*)
      # IPv6 literal: the port, if any, is outside the closing bracket.
      rest="${rest%%\]*}"
      printf '%s' "${rest#\[}"
      return
      ;;
  esac

  rest="${rest%%/*}"
  rest="${rest%%\?*}"
  rest="${rest%%:*}"
  printf '%s' "$rest"
}

# Whether a PostgreSQL connection URL addresses a managed Supabase Cloud project.
#
# Cloud projects are served from `db.<project-ref>.supabase.co` directly and
# from `aws-<index>-<region>.pooler.supabase.com` through the pooler. Note the
# two different registrable domains: the direct host is under .co, the pooler
# under .com, so both are matched.
is_supabase_cloud_url() {
  local host
  host="$(pg_url_host "$1")"
  case "$host" in
    supabase.co|*.supabase.co|supabase.com|*.supabase.com) return 0 ;;
    *) return 1 ;;
  esac
}
