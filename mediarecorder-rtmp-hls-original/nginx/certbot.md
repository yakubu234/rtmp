# =============================
# README: Nginx + Let's Encrypt SSL Setup for anthena.i.ng
# =============================

## STEP 1: Install Certbot

```bash
sudo apt update
sudo apt install certbot
```

## STEP 2: Stop Nginx Temporarily

```bash
sudo /usr/local/nginx/sbin/nginx -s stop
```

## STEP 3: Obtain SSL Certificate Using Certbot Standalone

```bash
sudo certbot certonly --standalone -d anthena.i.ng
```

- Certificates will be saved at: /etc/letsencrypt/live/anthena.i.ng/

## STEP 4: Nginx Configuration for anthena.i.ng

Create config file:

```bash
sudo nano /usr/local/nginx/sites-available/anthena.i.ng
```

Paste the following:

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name anthena.i.ng;

    return 301 https://$host$request_uri;
}

# HTTPS Server Block
server {
    listen 443 ssl;
    server_name anthena.i.ng;

    ssl_certificate /etc/letsencrypt/live/anthena.i.ng/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/anthena.i.ng/privkey.pem;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/anthena;  # Adjust to your actual site root
    index index.html index.htm;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

## STEP 5: Start or Reload Nginx

```bash
sudo /usr/local/nginx/sbin/nginx
# or if already running:
sudo /usr/local/nginx/sbin/nginx -s reload
```

## STEP 6: Verify HTTPS

Visit https://anthena.i.ng in your browser and verify the SSL padlock 🔒 is visible.

## STEP 7 (Optional): Setup Auto Renewal

Edit crontab:

```bash
sudo crontab -e
```

Add this line to renew every day at 3:00 AM:

```bash
0 3 * * * /usr/bin/certbot renew --quiet && /usr/local/nginx/sbin/nginx -s reload
```

---

✅ Done! Your domain now has HTTPS enabled via Let's Encrypt.
