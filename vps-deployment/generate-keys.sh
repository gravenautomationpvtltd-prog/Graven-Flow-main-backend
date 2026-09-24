#!/usr/bin/env bash
set -e

# ==============================================================================
# Generate Valid Supabase HS256 JWT Keys (Anon & Service Role)
# ==============================================================================

cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "Error: .env file not found in $(pwd)"
  exit 1
fi

# Load JWT_SECRET from .env
JWT_SECRET=$(grep '^JWT_SECRET=' .env | cut -d '=' -f2-)

if [ -z "$JWT_SECRET" ]; then
  echo "Error: JWT_SECRET not found in .env"
  exit 1
fi

echo "🔐 Generating cryptographic HS256 Supabase keys..."

# Use python3 (available on Ubuntu 24.04) to sign JWTs
KEYS=$(python3 -c "
import hmac, hashlib, base64, json

secret = '''$JWT_SECRET'''

def b64url(data):
    if isinstance(data, str):
        data = data.encode('utf-8')
    return base64.urlsafe_b64encode(data).decode('utf-8').rstrip('=')

def create_jwt(role):
    header = {'alg': 'HS256', 'typ': 'JWT'}
    payload = {
        'iss': 'supabase',
        'ref': 'graven-flow',
        'role': role,
        'iat': 1700000000,
        'exp': 2147483647
    }
    msg = f\"{b64url(json.dumps(header, separators=(',', ':')))}.{b64url(json.dumps(payload, separators=(',', ':')))}\"
    sig = hmac.new(secret.encode('utf-8'), msg.encode('utf-8'), hashlib.sha256).digest()
    return f\"{msg}.{b64url(sig)}\"

anon = create_jwt('anon')
service = create_jwt('service_role')
print(f'{anon}|{service}')
")

ANON_KEY=$(echo "$KEYS" | cut -d '|' -f1)
SERVICE_ROLE_KEY=$(echo "$KEYS" | cut -d '|' -f2)

# Update .env
if grep -q '^ANON_KEY=' .env; then
  sed -i "s|^ANON_KEY=.*|ANON_KEY=${ANON_KEY}|g" .env
else
  echo "ANON_KEY=${ANON_KEY}" >> .env
fi

if grep -q '^SERVICE_ROLE_KEY=' .env; then
  sed -i "s|^SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}|g" .env
else
  echo "SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}" >> .env
fi

# Restart Kong, PostgREST, and Auth to pick up the updated keys
echo "🔄 Reloading Supabase containers with new keys..."
docker compose up -d --force-recreate kong rest auth

SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "=================================================================="
echo "  ✅ Keys Generated & Applied Successfully!"
echo "=================================================================="
echo "Use these values for your Frontend (.env):"
echo ""
echo "VITE_SUPABASE_URL=http://${SERVER_IP}:8088"
echo "VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}"
echo "=================================================================="
