# Deployment Guide

## Prerequisites

- **Ubuntu** 22.04+ (or Debian 11+)
- **Node.js** 18+ (LTS recommended)
- **MySQL** 8.0+ (or MariaDB 10.6+)
- **Nginx**
- **npm** 9+
- **Git**

---

## 1. Server Setup (Ubuntu 22.04)

### Install Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

### Install MySQL

```bash
sudo apt install -y mysql-server
sudo mysql_secure_installation
```

### Install Nginx & Certbot

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

### Install PM2

```bash
sudo npm install -g pm2
```

### Setup Swap (recommended for 2GB RAM servers)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 2. Clone & Install

```bash
cd /root
git clone <repo-url> feedback
cd feedback

# Install server dependencies
cd server
npm install

# Install admin dependencies
cd ../admin
npm install
```

Or deploy from local machine using rsync:

```bash
# Run from your local machine
rsync -avz --exclude node_modules --exclude .env --exclude dist \
  ./server ./admin ./docs root@YOUR_VPS_IP:/root/feedback/

# Then SSH into the server and install
ssh root@YOUR_VPS_IP
cd /root/feedback/server && npm install
cd /root/feedback/admin && npm install
```

---

## 3. Environment Configuration

Create the env file:

```bash
nano /root/feedback/server/.env
```

```env
# Database (required)
DATABASE_URL="mysql://feedback:your-db-password@localhost:3306/feedback_tickets_db"

# Auth (required)
JWT_SECRET="generate-a-strong-random-secret"
GOOGLE_CLIENT_ID="your-google-client-id.apps.googleusercontent.com"

# Server
PORT=3000

# Email — global default (optional, leave empty to disable)
SMTP_HOST="mail.yourdomain.com"
SMTP_PORT=587
SMTP_USER="support@yourdomain.com"
SMTP_PASS="your-email-password"
SMTP_FROM="support@yourdomain.com"

# File uploads
UPLOAD_DIR="./uploads"
```

> **Per-app email:** Each app can override the global SMTP settings with its own sender email and/or its own SMTP server. Configure these in the admin panel under app settings.

### Generate a JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 4. Database Setup

Create the MySQL database and user:

```sql
sudo mysql

CREATE DATABASE feedback_tickets_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'feedback'@'localhost' IDENTIFIED BY 'your-db-password';
GRANT ALL PRIVILEGES ON feedback_tickets_db.* TO 'feedback'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Run migrations and generate Prisma client:

```bash
cd /root/feedback/server
npx prisma generate
npx prisma migrate deploy
```

Create the initial super admin:

```bash
cd /root/feedback/server

# Production — only creates super admin (recommended)
ADMIN_EMAIL="admin@yourdomain.com" ADMIN_PASSWORD="your-secure-password" npm run db:seed:prod

# Development — creates dummy data (apps, users, tickets, feedbacks)
# npm run db:seed
```

---

## 5. Build

```bash
# Build server (TypeScript → dist/)
cd /root/feedback/server
npm run build

# Build admin panel (React → dist/)
cd /root/feedback/admin
npm run build
```

---

## 6. Run with PM2

```bash
cd /root/feedback/server
pm2 start dist/index.js --name feedback-api
pm2 save
pm2 startup    # auto-start on reboot
```

**PM2 commands:**

```bash
pm2 logs feedback-api       # view logs
pm2 restart feedback-api    # restart
pm2 stop feedback-api       # stop
pm2 status                  # check status
```

---

## 7. Nginx Configuration

Create the site config:

```bash
sudo nano /etc/nginx/sites-available/feedbacktickets.myportfoliodata.com
```

```nginx
server {
    listen 80;
    server_name feedbacktickets.myportfoliodata.com;

    # Admin panel (static files)
    location / {
        root /root/feedback/admin/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://127.0.0.1:3000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # Uploaded files
    location /uploads/ {
        alias /root/feedback/server/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    client_max_body_size 10M;
}
```

Enable the site and reload:

```bash
sudo ln -s /etc/nginx/sites-available/feedbacktickets.myportfoliodata.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Enable HTTPS with Certbot

```bash
sudo certbot --nginx -d feedbacktickets.myportfoliodata.com
```

Certbot will auto-renew via a systemd timer.

---

## 8. DNS Configuration

Point your subdomain to the VPS by adding a DNS A record on your domain provider:

| Type | Host               | Value (IP)       | TTL  |
|------|--------------------|------------------|------|
| A    | feedbacktickets    | YOUR_VPS_IP      | 3600 |

DNS changes can take up to 24 hours to propagate (usually 5–30 minutes).

---

## 9. Email Setup

The system supports **two levels** of email configuration:

### Global Default (`.env`)

All apps use this SMTP server unless overridden:

```env
SMTP_HOST="mail.yourdomain.com"
SMTP_PORT=587
SMTP_USER="support@yourdomain.com"
SMTP_PASS="your-email-password"
SMTP_FROM="support@yourdomain.com"
```

### Per-App Override (Admin Panel)

Each app can have its own sender email and/or SMTP server. Configure in **Apps → Edit → Email Settings**:

| Field      | Description                                      |
|------------|--------------------------------------------------|
| Email From | Sender email address (e.g. `support@myapp.com`)  |
| Email Name | Sender display name (e.g. `MyApp Support`)       |
| SMTP Host  | Custom SMTP server (optional)                    |
| SMTP Port  | SMTP port — 587 (TLS) or 465 (SSL)              |
| SMTP User  | SMTP login username                              |
| SMTP Pass  | SMTP login password                              |

If per-app SMTP is not set, the global default is used. If per-app Email From is set but SMTP is not, it uses the global SMTP server with the custom From address.

### Email Notifications

The system sends emails for:
- Ticket created — notifies the user
- Status changed — notifies the ticket creator
- New comment — notifies the ticket creator and assigned developer
- Feedback reply — notifies the feedback submitter
- Welcome email — sent on first user registration

---

## 10. File Uploads

Create the uploads directory:

```bash
mkdir -p /root/feedback/server/uploads
chmod 755 /root/feedback/server/uploads
```

For production, consider:
- Moving uploads to S3/cloud storage
- Setting up periodic backups of the uploads directory
- Configuring `UPLOAD_DIR` as an absolute path

---

## 11. Database Backups

### Automated MySQL Backup (cron)

```bash
sudo mkdir -p /backups

# Add to crontab (daily at 2 AM)
crontab -e
```

Add this line:

```
0 2 * * * mysqldump -u feedback -p'your-db-password' feedback_tickets_db | gzip > /backups/feedback_$(date +\%Y\%m\%d).sql.gz
```

### Prisma Migrations in Production

Always use `migrate deploy` (not `migrate dev`) in production:

```bash
cd /root/feedback/server
npx prisma migrate deploy
```

---

## 12. Health Check

The server exposes a health endpoint:

```
GET /health → { "status": "ok", "timestamp": "..." }
```

Use this for monitoring or load balancer health checks.

---

## 13. SLA Configuration

Default SLA deadlines (configured in `server/src/config.ts`):

| Priority | Deadline           |
|----------|--------------------|
| Critical | 4 hours            |
| High     | 24 hours           |
| Medium   | 72 hours (3 days)  |
| Low      | 168 hours (7 days) |

---

## 14. Updating / Redeploying

From your local machine:

```bash
# Sync code changes
rsync -avz --exclude node_modules --exclude .env --exclude dist \
  ./server ./admin root@YOUR_VPS_IP:/root/feedback/

# SSH into server
ssh root@YOUR_VPS_IP

# Rebuild and restart
cd /root/feedback/server
npm install
npx prisma generate
npx prisma migrate deploy
npm run build
pm2 restart feedback-api

# Rebuild admin panel
cd /root/feedback/admin
npm install
npm run build
```

---

## Firewall (Optional)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
```

---

## Quick Reference

```bash
# Development (local)
cd server && npm run dev     # API with hot reload (port 3000)
cd admin && npm run dev      # Admin panel with HMR (port 5173)

# Production build
cd server && npm run build
cd admin && npm run build

# Database
cd server
npx prisma migrate deploy   # Apply migrations
npx prisma generate          # Regenerate client
npm run db:seed:prod         # Seed super admin only

# PM2
pm2 start dist/index.js --name feedback-api
pm2 logs feedback-api
pm2 restart feedback-api
pm2 status

# Nginx
sudo nginx -t                # Test config
sudo systemctl reload nginx  # Reload
sudo systemctl status nginx  # Check status

# SSL
sudo certbot --nginx -d feedbacktickets.myportfoliodata.com
sudo certbot renew --dry-run  # Test renewal
```
