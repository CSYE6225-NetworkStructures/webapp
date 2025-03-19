#!/bin/bash

# Add group and user if not exists
sudo groupadd -f csye6225
sudo useradd -r -M -g csye6225 -s /usr/sbin/nologin csye6225

# Update packages
sudo apt-get update -y

# Setup application directory
sudo mkdir -p /opt/myapp
sudo mv /tmp/webapp /opt/myapp/webapp
sudo chmod +x /opt/myapp/webapp

# Change ownership and permissions for application directory
sudo chown -R csye6225:csye6225 /opt/myapp
sudo chmod -R 750 /opt/myapp