# AstralExp Production Deployment & APK Build Guide

This comprehensive guide explains how to transition your full-stack AstralExp monorepo (Django + React Native) into a production-ready system. This document addresses exactly how to host the backend on AWS EC2, bypass Android's unencrypted HTTP (Cleartext) restrictions natively seamlessly via Expo, and manually trigger an APK build over the web.

## 1. Hosting the Django Backend on AWS (EC2)

Instead of running `python manage.py runserver 0.0.0.0:8000` locally, you will host the Django REST application permanently online.

### Step 1.1: Launch an EC2 Instance
1. Go to AWS Console -> EC2 Dashboard -> **Launch Instance**.
2. Select **Ubuntu Server 24.04 LTS**.
3. Create a **t2.micro** (Free Tier eligible) instance.
4. Download the `.pem` key file and SSH into the machine:
   `ssh -i "your-key.pem" ubuntu@<your-ec2-public-ip>`

### Step 1.2: Set Up the Environment
Run these commands instantly inside the Ubuntu terminal:
```bash
sudo apt update
sudo apt install python3-pip python3-venv git nginx postgresql postgresql-contrib libpq-dev
git clone https://github.com/astradevop/ASTRALEXP.git
cd ASTRALEXP/backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install gunicorn psycopg2-binary
```

### Step 1.3: Set up PostgreSQL Database 
Django expects a PostgreSQL database to exist before migrations can run. Let's create it on the AWS server:
```bash
sudo -u postgres psql
```
*Inside the SQL prompt, type:*
```sql
CREATE DATABASE astralexp_db;
ALTER USER postgres WITH PASSWORD '8848';
ALTER ROLE postgres SET client_encoding TO 'utf8';
ALTER ROLE postgres SET default_transaction_isolation TO 'read committed';
ALTER ROLE postgres SET timezone TO 'UTC';
GRANT ALL PRIVILEGES ON DATABASE astralexp_db TO postgres;
\q
```

### Step 1.4: Configure Production Database & Static files
Update `.env` on your EC2 specifically for prod:
```bash
nano .env # Add your Razorpay, Gemini, and EC2 Public IP to ALLOWED_HOSTS
python manage.py makemigrations
python manage.py migrate
```

### Step 1.5: Configure Gunicorn Systemd Service
Instead of running Gunicorn manually, we will create robust systemd service files so your backend automatically restarts on server reboots or crashes.

Create the Gunicorn socket file:
```bash
sudo nano /etc/systemd/system/gunicorn.socket
```
*Paste this content:*
```ini
[Unit]
Description=gunicorn socket

[Socket]
ListenStream=/run/gunicorn.sock

[Install]
WantedBy=sockets.target
```

Create the Gunicorn service file:
```bash
sudo nano /etc/systemd/system/gunicorn.service
```
*Paste this content:*
```ini
[Unit]
Description=gunicorn daemon
Requires=gunicorn.socket
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/home/ubuntu/ASTRALEXP/backend
ExecStart=/home/ubuntu/ASTRALEXP/backend/venv/bin/gunicorn \
          --access-logfile - \
          --workers 3 \
          --bind unix:/run/gunicorn.sock \
          config.wsgi:application

[Install]
WantedBy=multi-user.target
```

Start and enable Gunicorn so it boots automatically:
```bash
sudo systemctl start gunicorn.socket
sudo systemctl enable gunicorn.socket
```

### Step 1.6: Configure NGINX Reverse Proxy
Now link NGINX to the `gunicorn.sock` Unix socket we just created securely!
```bash
sudo nano /etc/nginx/sites-available/astralexp
```
*Paste this content:*
```nginx
server {
    listen 80;
    server_name <your-ec2-public-ip>;

    location / {
        proxy_pass http://unix:/run/gunicorn.sock;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

*Enable it and verify syntax:*
```bash
sudo ln -s /etc/nginx/sites-available/astralexp /etc/nginx/sites-enabled
sudo nginx -t
sudo systemctl restart nginx
```
Your backend API is now permanently available at `http://<your-ec2-public-ip>`.

---

## 2. Bypassing Android HTTP Restrictions inside Expo

Because you do not have a custom SSL certificate/domain yet, the AWS EC2 returns connection data via HTTP (Port 80) instead of HTTPS (Port 443). By default, Android 9.0+ **strictly drops all HTTP API calls** preventing `axios` and `fetch` from hitting the AWS IP!

### How we solved it gracefully:
I proactively installed the `expo-build-properties` plugin to your frontend app and injected:
```json
// app.json
"plugins": [
  [
    "expo-build-properties",
    {
      "android": {
        "usesCleartextTraffic": true
      }
    }
  ]
]
```
When you run the APK build script, Expo will automatically translate this native instruction and forcefully inject `android:usesCleartextTraffic="true"` directly into the compiled compiled Android Manifest (`AndroidManifest.xml`)! *You don't need to eject your project!* Your physical Android phone will now securely allow fetching API requests from `http://<your-ec2-public-ip>`.

---

## 3. Creating the APK Using Expo EAS Build (Web)

To convert this React Native codebase into an installable `.apk` file for Android devices, we use Expo Application Services (EAS) cloud compilation.

### Step 3.1: Configure the API URL
Before building, open `mobile/src/services/api.js` and change your local `localhost` network IP to the AWS IP. 

### Step 3.2: Configure `eas.json`
Inside the `mobile/` directory, I've created the `eas.json` configuration file, preparing the build profile to extract `.apk` specifically rather than the default `.aab` (Google Play format).

### Step 3.3: Trigger Compile Process!
Open your terminal inside the `/mobile` directory and authenticate with Expo. If you are already logged into an old account, log out first:
```bash
npx eas logout
npx eas login
```
Trigger the cloud compilation:
```bash
npx eas build -p android --profile preview
```
1. Expo will compress your JS project and upload it securely to their build farm online.
2. It'll give you an immediate web link (`https://expo.dev/accounts/...`) so you can watch your Android APK build live directly in your browser.
3. Once completed (typically ~6 minutes), you can download the final `app-preview.apk` directly to your phone, install it, and use AstralExp natively!
