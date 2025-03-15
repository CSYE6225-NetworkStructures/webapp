#!/bin/bash

# This script prepares the environment for Terraform AMI migration
# It ensures all snapshots associated with the AMI are properly shared with the target account
# Usage: ./preami.sh <ami_id>

set -e

# Check if AMI ID was provided
if [ -z "$1" ]; then
  echo "Error: AMI ID is required"
  echo "Usage: $0 <ami_id>"
  exit 1
fi

SOURCE_AMI_ID=$1
AWS_REGION="us-east-1"

# Get environment variables from GitHub Actions
SOURCE_AWS_ACCESS_KEY="${DEV_AWS_ACCESS_KEY}"
SOURCE_AWS_SECRET_KEY="${DEV_AWS_SECRET_KEY}"
TARGET_AWS_ACCESS_KEY="${DEMO_AWS_ACCESS_KEY}"
TARGET_AWS_SECRET_KEY="${DEMO_AWS_SECRET_KEY}"

# Check if credentials are set
if [ -z "$SOURCE_AWS_ACCESS_KEY" ] || [ -z "$SOURCE_AWS_SECRET_KEY" ] || [ -z "$TARGET_AWS_ACCESS_KEY" ] || [ -z "$TARGET_AWS_SECRET_KEY" ]; then
  echo "Error: AWS credentials are not set in environment variables"
  exit 1
fi

# Get Source Account ID
export AWS_ACCESS_KEY_ID=$SOURCE_AWS_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SOURCE_AWS_SECRET_KEY
export AWS_DEFAULT_REGION=$AWS_REGION

echo "Getting source account ID..."
SOURCE_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
echo "Source Account ID: $SOURCE_ACCOUNT_ID"

# Get Target Account ID
export AWS_ACCESS_KEY_ID=$TARGET_AWS_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$TARGET_AWS_SECRET_KEY

echo "Getting target account ID..."
TARGET_ACCOUNT_ID=$(aws sts get-caller-identity --query 'Account' --output text)
echo "Target Account ID: $TARGET_ACCOUNT_ID"

# Switch back to source account for operations
export AWS_ACCESS_KEY_ID=$SOURCE_AWS_ACCESS_KEY
export AWS_SECRET_ACCESS_KEY=$SOURCE_AWS_SECRET_KEY

# Share the AMI with the Target Account
echo "Sharing AMI ($SOURCE_AMI_ID) with target account ($TARGET_ACCOUNT_ID)..."
aws ec2 modify-image-attribute \
    --image-id $SOURCE_AMI_ID \
    --launch-permission "Add=[{UserId=$TARGET_ACCOUNT_ID}]" \
    --region $AWS_REGION

# Get all snapshot IDs associated with the AMI (not just the first one)
echo "Fetching all Snapshot IDs for AMI: $SOURCE_AMI_ID..."
SNAPSHOT_IDS=$(aws ec2 describe-images \
    --image-ids $SOURCE_AMI_ID \
    --region $AWS_REGION \
    --query 'Images[0].BlockDeviceMappings[*].Ebs.SnapshotId' \
    --output text)

if [ -z "$SNAPSHOT_IDS" ]; then
  echo "Error: No snapshots found for AMI $SOURCE_AMI_ID"
  exit 1
fi

echo "Found snapshots: $SNAPSHOT_IDS"

# Share each snapshot with the Target Account
for SNAPSHOT_ID in $SNAPSHOT_IDS; do
  echo "Sharing Snapshot ($SNAPSHOT_ID) with target account ($TARGET_ACCOUNT_ID)..."
  aws ec2 modify-snapshot-attribute \
      --snapshot-id $SNAPSHOT_ID \
      --attribute createVolumePermission \
      --operation-type add \
      --user-ids $TARGET_ACCOUNT_ID \
      --region $AWS_REGION
  
  echo "Verifying snapshot sharing..."
  aws ec2 describe-snapshot-attribute \
      --snapshot-id $SNAPSHOT_ID \
      --attribute createVolumePermission \
      --region $AWS_REGION
done

echo "All snapshots have been shared with target account"
echo "Waiting 10 seconds for permissions to propagate..."
sleep 10

echo "Preparation complete. You can now run the Terraform script."