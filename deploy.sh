#!/bin/bash

# Exit on error
set -e

# Configuration
VPS_USER="household"  # Ersetze dies mit deinem VPS-Benutzernamen
VPS_HOST="176.103.220.130"
APP_DIR="/var/www/household"
DOMAIN="app.laux.media"

# Build the frontend
echo "Building frontend..."
npm run build

# Create deployment package
echo "Creating deployment package..."
rm -f household-deploy.tar.gz
tar -czf household-deploy.tar.gz \
  package.json \
  package-lock.json \
  ecosystem.config.js \
  .env.production \
  server/ \
  dist/ \
  public/

# Upload to server
echo "Uploading to server..."
scp household-deploy.tar.gz $VPS_USER@$VPS_HOST:~/

# Deploy on server
echo "Deploying on server..."
ssh $VPS_USER@$VPS_HOST "
  mkdir -p $APP_DIR && \
  tar -xzf ~/household-deploy.tar.gz -C $APP_DIR && \
  cd $APP_DIR && \
  mv .env.production .env && \
  npm ci --only=production && \
  pm2 restart ecosystem.config.js --env production || pm2 start ecosystem.config.js --env production
"

echo "Deployment completed successfully!"
