#!/usr/bin/env bash
set -e

# ==============================================================================
# Graven Flow - PostgreSQL Database Restore Script (Postgres 17 Compatible)
# Uses postgres:17-alpine pg_restore to support version 1.16 dump headers
# ==============================================================================

# Load environment variables from .env if present
if [ -f .env ]; then
  POSTGRES_PASSWORD=$(grep '^POSTGRES_PASSWORD=' .env | cut -d '=' -f2-)
  POSTGRES_DB=$(grep '^POSTGRES_DB=' .env | cut -d '=' -f2-)
fi
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-postgres}"

BACKUP_FILE=""
for candidate in \
  "./flow-whisper-79_260924.backup" \
  "./flow-whisper-79_260924.backup/flow-whisper-79_260924.backup" \
  "../flow-whisper-79_260924.backup/flow-whisper-79_260924.backup" \
  "./database.backup"; do
  if [ -f "$candidate" ]; then
    BACKUP_FILE="$(cd "$(dirname "$candidate")" && pwd)/$(basename "$candidate")"
    break
  fi
done

if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "⚠️ Warning: Database backup file not found. Starting with clean database."
  exit 0
fi

echo "📦 Found backup file: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

echo "⏳ Waiting for PostgreSQL container to become ready..."
until docker exec graven-postgres pg_isready -U postgres -d postgres > /dev/null 2>&1; do
  sleep 2
done

echo "🚀 Restoring PostgreSQL 17 database schema and data..."
BACKUP_DIR="$(dirname "$BACKUP_FILE")"
BACKUP_NAME="$(basename "$BACKUP_FILE")"

docker run --rm \
  --network vps-deployment_default \
  -v "${BACKUP_DIR}:/backup:ro" \
  -e PGPASSWORD="${POSTGRES_PASSWORD}" \
  postgres:17-alpine \
  pg_restore --verbose --clean --if-exists --no-owner --no-privileges \
    -h graven-postgres -U postgres -d "${POSTGRES_DB}" "/backup/${BACKUP_NAME}" || true

echo "✅ Database restore completed successfully!"
