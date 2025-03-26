#!/bin/bash

# Add group and user if not exists
sudo groupadd -f csye6225
sudo useradd -r -M -g csye6225 -s /usr/sbin/nologin csye6225

# Update packages
sudo apt-get update -y

# Install CloudWatch Agent dependencies
sudo apt-get install -y curl unzip jq python3-pip wget

# Get region and instance ID
AWS_REGION=$(curl -s --connect-timeout 5 http://169.254.169.254/latest/meta-data/placement/region || echo "us-east-1")
EC2_INSTANCE_ID=$(curl -s http://169.254.169.254/latest/meta-data/instance-id || echo "unknown-instance")

echo "Running in AWS region: $AWS_REGION on EC2 instance: $EC2_INSTANCE_ID"

# Install CloudWatch Agent for Ubuntu
echo "Installing AWS CloudWatch Agent for Ubuntu..."
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# Create a CloudWatch agent configuration file with just StatsD metrics
echo "Creating CloudWatch Agent configuration..."
sudo mkdir -p /opt/aws/amazon-cloudwatch-agent/etc/

# Create the configuration file specifically for timer and count metrics
sudo tee /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json > /dev/null << 'EOF'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "root"
  },
  "metrics": {
    "metrics_collected": {
      "statsd": {
        "service_address": ":8125",
        "metrics_collection_interval": 60,
        "metrics_aggregation_interval": 60
      }
    },
    "append_dimensions": {
      "InstanceId": "${aws:InstanceId}"
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/opt/myapp/logs/application.log",
            "log_group_name": "webapp-logs",
            "log_stream_name": "{instance_id}-application",
            "retention_in_days": 7
          },
          {
            "file_path": "/opt/myapp/logs/error.log",
            "log_group_name": "webapp-logs",
            "log_stream_name": "{instance_id}-error",
            "retention_in_days": 7
          }
        ]
      }
    }
  }
}
EOF

# Ensure correct permissions
sudo chmod 644 /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Setup application directory
sudo mkdir -p /opt/myapp
sudo mv /tmp/webapp /opt/myapp/webapp
sudo chmod +x /opt/myapp/webapp

# Create logs directory with proper permissions
sudo mkdir -p /opt/myapp/logs
sudo touch /opt/myapp/logs/application.log
sudo touch /opt/myapp/logs/error.log

# Change ownership and permissions for application directory
sudo chown -R csye6225:csye6225 /opt/myapp
sudo chmod -R 750 /opt/myapp

# Enable and start the CloudWatch agent service
echo "Enabling and starting CloudWatch Agent..."
sudo systemctl enable amazon-cloudwatch-agent
sudo systemctl start amazon-cloudwatch-agent

# Verify status
if systemctl is-active --quiet amazon-cloudwatch-agent; then
  echo "CloudWatch Agent service is running"
else
  echo "Attempting to start CloudWatch Agent with configuration file..."
  sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json
  sudo systemctl restart amazon-cloudwatch-agent
fi

# Create a service override for dependencies
echo "Creating service dependencies..."
sudo mkdir -p /etc/systemd/system/webapp.service.d/
sudo chmod 755 /etc/systemd/system/webapp.service.d/
sudo tee /etc/systemd/system/webapp.service.d/override.conf > /dev/null << EOF
[Unit]
After=network.target amazon-cloudwatch-agent.service
Wants=amazon-cloudwatch-agent.service
EOF

echo "Reloading systemd configuration..."
sudo systemctl daemon-reload
sudo systemctl enable webapp.service

echo "Setup complete!"