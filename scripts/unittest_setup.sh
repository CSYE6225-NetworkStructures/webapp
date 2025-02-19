#!/bin/bash

# Usage: ./script.sh <mysql_root_password>
# Alternatively, export MYSQL_ROOT_PASSWORD="YourPassword" before running the script.

DB_NAME="healthcheck"
APP_GROUP="webAPIGroup"
APP_USER="webAPIUser"
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

# Function to install Node.js and npm
install_nodejs_npm() {
    if ! command -v node &> /dev/null; then
        echo "Node.js is not installed. Installing..."
        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -  # Set up Node.js repo
        sudo apt install -y nodejs
    else
        echo "Node.js is already installed."
    fi

    if ! command -v npm &> /dev/null; then
        echo "npm is not installed. Installing..."
        sudo apt install -y npm
    else
        echo "npm is already installed."
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

echo "Installing Node.js and npm..."
install_nodejs_npm

echo "Setup completed successfully!"
