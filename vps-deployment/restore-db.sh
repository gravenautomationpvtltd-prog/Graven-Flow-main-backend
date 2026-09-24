#!/usr/bin/env bash
set -e

# ==============================================================================
# Graven Flow - PostgreSQL Database Restore Script
# Restores flow-whisper-79_260924.backup into the Docker Postgres container
# ==============================================================================

BACKUP_FILE=""
for candidate in \
  "./flow-whisper-79_260924.backup" \
  "./flow-whisper-79_260924.backup/flow-whisper-79_260924.backup" \
  "../flow-whisper-79_260924.backup/flow-whisper-79_260924.backup" \
  "./database.backup"; do
  if [ -f "$candidate" ]; then
    BACKUP_FILE="$candidate"
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

echo "🔄 Copying backup file into container..."
docker cp "$BACKUP_FILE" graven-postgres:/tmp/restore.backup

echo "🚀 Restoring database schema and data..."
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" graven-postgres \
  pg_restore --verbose --clean --if-exists --no-owner --no-privileges -U postgres -d postgres /tmp/restore.backup || true

echo "🧹 Cleaning up temporary container files..."
docker exec graven-postgres rm -f /tmp/restore.backup

echo "✅ Database restore completed successfully!"
