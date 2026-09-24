#!/usr/bin/env bash
# ==============================================================================
# Graven Flow - Automated Turnkey VPS Setup & Deployment Script
# Tested on Ubuntu 20.04 / 22.04 / 24.04 LTS & Debian 11 / 12
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}==================================================================${NC}"
echo -e "${BLUE}         Graven Flow - VPS Backend Automated Deployment           ${NC}"
echo -e "${BLUE}==================================================================${NC}"

# Check for root / sudo
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}❌ Please run this script as root or with sudo: sudo bash setup-vps.sh${NC}"
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Update system packages
echo -e "\n${YELLOW}📦 [1/6] Updating system packages & installing dependencies...${NC}"
apt-get update -y
apt-get install -y curl wget git ufw openssl jq ca-certificates gnupg lsb-release

# 2. Install Docker & Docker Compose if not installed
echo -e "\n${YELLOW}🐳 [2/6] Checking Docker & Docker Compose...${NC}"
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm -f get-docker.sh
  systemctl enable --now docker
else
  echo -e "${GREEN}✓ Docker already installed ($(docker --version))${NC}"
fi

# 3. Configure Firewall (UFW)
echo -e "\n${YELLOW}🛡️ [3/6] Configuring firewall rules...${NC}"
# Stop native PostgreSQL service on host if installed to prevent port clashes
systemctl stop postgresql 2>/dev/null || true
systemctl disable postgresql 2>/dev/null || true

ufw allow 22/tcp comment 'SSH' || true
ufw allow 80/tcp comment 'HTTP' || true
ufw allow 443/tcp comment 'HTTPS' || true
ufw allow 8000/tcp comment 'Kong API Gateway' || true
ufw allow 3000/tcp comment 'Supabase Studio' || true
ufw --force enable || true
echo -e "${GREEN}✓ Firewall configured.${NC}"

# 4. Generate .env configuration if not present
echo -e "\n${YELLOW}🔐 [4/6] Setting up environment secrets & keys...${NC}"
if [ ! -f .env ]; then
  cp .env.example .env

  # Generate random 32-character password & secret
  RAND_PASS=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 24)
  RAND_JWT=$(openssl rand -base64 48 | tr -dc 'a-zA-Z0-9' | head -c 40)
  
  # Detect public IP
  SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')

  sed -i "s|your_super_strong_postgres_password_here|${RAND_PASS}|g" .env
  sed -i "s|super-secret-jwt-token-with-at-least-32-characters-length|${RAND_JWT}|g" .env
  sed -i "s|http://localhost:8000|http://${SERVER_IP}:8000|g" .env
  
  echo -e "${GREEN}✓ Generated fresh .env with secure random PostgreSQL password and JWT secret.${NC}"
else
  echo -e "${GREEN}✓ Using existing .env file.${NC}"
fi

# 5. Start Supabase Stack
echo -e "\n${YELLOW}🚀 [5/6] Starting Supabase containers with Docker Compose...${NC}"
docker compose pull
docker compose down --remove-orphans || true
docker compose up -d

echo -e "\n${YELLOW}⏳ Waiting for PostgreSQL to be healthy...${NC}"
until docker exec graven-postgres pg_isready -U postgres -d postgres > /dev/null 2>&1; do
  echo "Still waiting for database..."
  sleep 3
done
echo -e "${GREEN}✓ PostgreSQL database is healthy and ready!${NC}"

# 6. Database Restore
echo -e "\n${YELLOW}💾 [6/6] Checking for database backup to restore...${NC}"
if [ -f "./restore-db.sh" ]; then
  chmod +x ./restore-db.sh
  ./restore-db.sh
fi

SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')

echo -e "\n${GREEN}==================================================================${NC}"
echo -e "${GREEN}  🎉 Graven Flow Backend Successfully Deployed!                   ${NC}"
echo -e "${GREEN}==================================================================${NC}"
echo -e "🔗 ${BLUE}API Gateway (Supabase URL):${NC} http://${SERVER_IP}:8000"
echo -e "🖥️ ${BLUE}Supabase Studio (Dashboard):${NC} http://${SERVER_IP}:3000"
echo -e "🗄️ ${BLUE}PostgreSQL Port:${NC} 5432"
echo -e "\n${YELLOW}Next Step for Frontend (Hostinger):${NC}"
echo -e "Update your frontend environment with your VPS URL:"
echo -e "VITE_SUPABASE_URL=http://${SERVER_IP}:8000"
echo -e "=================================================================="
