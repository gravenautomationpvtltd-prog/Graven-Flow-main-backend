# Graven Flow - VPS Backend Deployment Guide

This directory contains the complete self-hosted **Supabase Backend Stack** with Docker Compose, including automated setup and database restore scripts.

---

## 📁 Package Contents

| File | Purpose |
| :--- | :--- |
| `setup-vps.sh` | One-click script to install Docker, configure firewall, launch containers, and restore the database |
| `docker-compose.yml` | Supabase services (PostgreSQL 15, Kong Gateway, GoTrue Auth, PostgREST, Realtime, Storage, Studio) |
| `kong.yml` | Declarative routing configuration for the Kong API Gateway |
| `.env.example` | Environment configuration template |
| `restore-db.sh` | Automated PostgreSQL database restore script |
| `nginx.conf` | Production SSL reverse proxy template for your custom domain |

---

## 🚀 Quick Deployment in 3 Steps

### Step 1: Copy Deployment Files & Backup to your VPS
From your local terminal (or using SCP/FileZilla/WinSCP):
```bash
# Upload vps-deployment folder and database backup to VPS
scp -r vps-deployment root@<YOUR_VPS_IP>:/root/
scp -r flow-whisper-79_260924.backup root@<YOUR_VPS_IP>:/root/vps-deployment/
```

### Step 2: SSH into your VPS
```bash
ssh root@<YOUR_VPS_IP>
cd /root/vps-deployment
```

### Step 3: Run the Automated Setup
```bash
chmod +x setup-vps.sh restore-db.sh
sudo bash setup-vps.sh
```

The script will automatically:
1. Install Docker & Docker Compose
2. Configure UFW Firewall rules (ports 22, 80, 443, 8000, 3000)
3. Generate secure random passwords and JWT keys
4. Launch all Supabase containers via `docker compose`
5. Restore `flow-whisper-79_260924.backup` into PostgreSQL

---

## 🔗 Endpoints After Deployment
- **API Gateway (Supabase URL)**: `http://<YOUR_VPS_IP>:8000`
- **Supabase Studio (Dashboard)**: `http://<YOUR_VPS_IP>:3000`
- **PostgreSQL Database Port**: `5432`

---

## 🔒 Optional: Setup Domain & Free SSL (Let's Encrypt)
If you have a domain pointed to your VPS (e.g., `api.yourdomain.com`):
```bash
# 1. Install Certbot
apt install -y certbot python3-certbot-nginx nginx

# 2. Copy Nginx configuration
cp nginx.conf /etc/nginx/sites-available/graven-flow
ln -s /etc/nginx/sites-available/graven-flow /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# 3. Obtain SSL certificates
certbot --nginx -d api.yourdomain.com
```
