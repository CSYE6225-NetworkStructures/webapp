#!/bin/bash

# Usage: ./script.sh <mysql_root_password>
# Alternatively, export MYSQL_ROOT_PASSWORD="YourPassword" before running the script.

DB_NAME="healthcheck"
APP_GROUP="webAPIGroup"
APP_USER="webAPIUser"
LOCAL_APP_PATH="./webapp.zip"           
REMOTE_APP_DIR="/opt/csye6225"
MYSQL_ROOT_PASSWORD=${1:-$MYSQL_ROOT_PASSWORD}  

# Check if MySQL password is provided
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    echo "Error: MySQL root password is required."
    echo "Provide it as a command-line argument or set the MYSQL_ROOT_PASSWORD environment variable."
    exit 1
fi

# Function to check if 'unzip' is installed
check_unzip() {
    if ! command -v unzip &> /dev/null; then
        echo "'unzip' could not be found. Installing..."
        sudo apt update -y
        sudo apt install unzip -y
    else
        echo "'unzip' is already installed."
    fi
}

# Function to secure MySQL installation and set root password
secure_mysql() {
    echo "Securing MySQL installation..."

    # Set the root password and secure the MySQL server
    sudo mysql <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH 'mysql_native_password' BY '$MYSQL_ROOT_PASSWORD';
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOF
}

echo "Updating package lists and upgrading packages..."
sudo apt update && sudo apt upgrade -y

echo "Installing MySQL Server..."
sudo apt install mysql-server -y

echo "Starting and enabling MySQL service..."
sudo systemctl enable --now mysql

echo "Securing MySQL installation..."
secure_mysql

echo "Creating database $DB_NAME..."
sudo mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME;"

echo "Creating Linux group: $APP_GROUP..."
sudo groupadd -f $APP_GROUP

echo "Creating user: $APP_USER and adding to group $APP_GROUP..."
sudo useradd -m -g $APP_GROUP -s /bin/bash $APP_USER || echo "User already exists"

echo "Checking if 'unzip' is installed..."
check_unzip

echo "Unzipping application from $LOCAL_APP_PATH..."
sudo mkdir -p "$REMOTE_APP_DIR"
sudo unzip -o "$LOCAL_APP_PATH" -d "$REMOTE_APP_DIR"

echo "Changing ownership and permissions for the application directory..."
sudo chown -R "$APP_USER:$APP_GROUP" "$REMOTE_APP_DIR"
sudo chmod -R 750 "$REMOTE_APP_DIR"

echo "Setup completed successfully!"
