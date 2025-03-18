#!/bin/bash

# Assign script arguments to variables
DB_HOST=$1
DB_PORT=$2
DB_USER=$3
DB_PASSWORD=$4
DB_NAME=$5
PORT=$6
AWS_REGION=$7
S3_BUCKET_NAME=$8

# Add group and user if not exists
sudo groupadd -f csye6225
sudo useradd -r -M -g csye6225 -s /usr/sbin/nologin csye6225

# Update packages
sudo apt-get update -y

# Setup application directory
sudo mkdir -p /opt/myapp
sudo mv /tmp/webapp /opt/myapp/webapp
sudo chmod +x /opt/myapp/webapp

# # Create .env file with provided arguments
# cat <<EOF | sudo tee /opt/myapp/.env > /dev/null
# DB_HOST=$DB_HOST
# DB_PORT=$DB_PORT
# DB_USER=$DB_USER
# DB_PASSWORD=$DB_PASSWORD
# DB_NAME=$DB_NAME
# PORT=$PORT
# AWS_REGION=$AWS_REGION
# S3_BUCKET_NAME=$S3_BUCKET_NAME
# EOF

# # Set permissions for .env file
# sudo chmod 600 /opt/myapp/.env

# Change ownership and permissions for application directory
sudo chown -R csye6225:csye6225 /opt/myapp
sudo chmod -R 750 /opt/myapp

# Move service file and set correct permissions
sudo mv /tmp/webapp.service /etc/systemd/system/webapp.service
sudo chmod 644 /etc/systemd/system/webapp.service

# # Reload systemd, enable and start service
# sudo systemctl daemon-reload
# sudo systemctl enable webapp
# sudo systemctl start webapp


# example usage of the script
# ./setup.sh 127.0.0.1 3306 root "Welcome@1234!!" health_check 8080 us-east-1 my-bucket-name