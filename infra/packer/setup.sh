#!/bin/bash

MYSQL_ROOT_PASSWORD="Welcome@1234!!"

sudo groupadd -f csye6225
sudo useradd -r -M -g csye6225 -s /usr/sbin/nologin csye6225

sudo apt-get update -y
sudo apt-get install -y mysql-server

sudo systemctl enable mysql
sudo systemctl start mysql

secure_mysql() {
    echo "Securing MySQL installation..."
    sudo mysql <<EOF
ALTER USER 'root'@'localhost' IDENTIFIED WITH 'mysql_native_password' BY '$MYSQL_ROOT_PASSWORD';
DELETE FROM mysql.user WHERE User='';
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';
FLUSH PRIVILEGES;
EOF
}
secure_mysql

sudo mkdir -p /opt/myapp
sudo mv /tmp/webapp /opt/myapp/webapp
sudo chmod +x /opt/myapp/webapp

cat <<EOF | sudo tee /opt/myapp/.env > /dev/null
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=Welcome@1234!!
DB_NAME=health_check
PORT=8080
EOF

sudo chmod 600 /opt/myapp/.env

sudo chown -R csye6225:csye6225 /opt/myapp
sudo chmod -R 750 /opt/myapp

sudo mv /tmp/webapp.service /etc/systemd/system/webapp.service
sudo chmod 644 /etc/systemd/system/webapp.service

sudo systemctl daemon-reload
sudo systemctl enable webapp
sudo systemctl start webapp
