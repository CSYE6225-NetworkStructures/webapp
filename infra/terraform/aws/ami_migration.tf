terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Source AWS provider
provider "aws" {
  alias      = "source"
  region     = var.aws_region
  access_key = var.source_aws_access_key
  secret_key = var.source_aws_secret_key
}

# Target AWS provider
provider "aws" {
  alias      = "target"
  region     = var.aws_region
  access_key = var.target_aws_access_key
  secret_key = var.target_aws_secret_key
}

# Variables for credentials (Set these in terraform.tfvars or CLI -var flag)
variable "source_aws_access_key" {}
variable "source_aws_secret_key" {}
variable "target_aws_access_key" {}
variable "target_aws_secret_key" {}

variable "aws_region" {
  default = "us-east-1"
}

variable "source_ami_id" {
  description = "The ID of the source AMI to copy"
}

# Use locals for dynamic values
locals {
  new_ami_name = "copied-custom-nodejs-mysql-${formatdate("YYYYMMDD-HHmmss", timestamp())}"
}

# Fetch source AWS account ID
data "aws_caller_identity" "source" {
  provider = aws.source
}

# Fetch target AWS account ID
data "aws_caller_identity" "target" {
  provider = aws.target
}

# Share the AMI with the target account
resource "aws_ami_launch_permission" "ami_permission" {
  provider   = aws.source
  image_id   = var.source_ami_id
  account_id = data.aws_caller_identity.target.account_id
}

# Get the source AMI details - just for reference
data "aws_ami" "source_ami_details" {
  provider = aws.source
  owners   = [data.aws_caller_identity.source.account_id]

  filter {
    name   = "image-id"
    values = [var.source_ami_id]
  }
}

# Share the snapshots - using an external data source
# Note: These snapshots should be shared before running Terraform with the pre-terraform script
# This is included as a fallback to ensure snapshots are shared
resource "null_resource" "share_snapshots" {
  # Only run this when the AMI launch permission is created or updated
  triggers = {
    ami_permission = aws_ami_launch_permission.ami_permission.id
  }

  # Execute the script to share snapshots
  provisioner "local-exec" {
    command = <<-EOT
      # Get the snapshot IDs associated with the AMI
      echo "Fetching snapshot IDs for AMI ${var.source_ami_id}..."
      SNAPSHOT_IDS=$(aws ec2 describe-images --image-ids ${var.source_ami_id} --query 'Images[0].BlockDeviceMappings[*].Ebs.SnapshotId' --output text --region ${var.aws_region})
      
      if [ -z "$SNAPSHOT_IDS" ]; then
        echo "No snapshots found. This will cause the AMI copy to fail."
        exit 1
      fi
      
      echo "Found snapshots: $SNAPSHOT_IDS"
      
      # Share each snapshot with the target account
      for SNAPSHOT_ID in $SNAPSHOT_IDS; do
        echo "Sharing snapshot $SNAPSHOT_ID with account ${data.aws_caller_identity.target.account_id}..."
        aws ec2 modify-snapshot-attribute --snapshot-id $SNAPSHOT_ID --attribute createVolumePermission --operation-type add --user-ids ${data.aws_caller_identity.target.account_id} --region ${var.aws_region}
        echo "Verified snapshot $SNAPSHOT_ID sharing with target account"
      done
      
      # Wait a moment for permissions to propagate
      echo "Waiting for permissions to propagate..."
      sleep 15
    EOT
    
    environment = {
      AWS_ACCESS_KEY_ID     = var.source_aws_access_key
      AWS_SECRET_ACCESS_KEY = var.source_aws_secret_key
      AWS_DEFAULT_REGION    = var.aws_region
    }
  }
}

# Copy the AMI to the target account
resource "aws_ami_copy" "copied_ami" {
  provider          = aws.target
  name              = local.new_ami_name
  description       = "Copied AMI from source account"
  source_ami_id     = var.source_ami_id
  source_ami_region = var.aws_region
  encrypted         = false

  # Wait for the snapshot sharing to complete
  depends_on = [
    aws_ami_launch_permission.ami_permission,
    null_resource.share_snapshots
  ]
  
  # Add a timeouts block to give more time for the operation
  timeouts {
    create = "60m"
  }
  
  # Add tags that were in the original AMI
  tags = {
    Name        = local.new_ami_name
    Environment = "production"
    ManagedBy   = "terraform"
    CopySource  = var.source_ami_id
  }
}

output "copied_ami_id" {
  value = aws_ami_copy.copied_ami.id
}