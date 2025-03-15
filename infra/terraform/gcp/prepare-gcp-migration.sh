#!/bin/bash

# Default zone value - can be overridden with command line parameter
DEFAULT_ZONE="us-east1-b"
ZONE=${1:-$DEFAULT_ZONE}

# Paths to GCP Service Account JSON Keys using GitHub Actions secrets
DEV_GCP_KEY="gcp-dev-credentials.json"
DEMO_GCP_KEY="gcp-demo-credentials.json"

# Function to log messages with timestamps
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1"
}

log "Extracting project IDs from credentials..."

# Extract project IDs from credential files
DEV_PROJECT_ID=$(cat $DEV_GCP_KEY | jq -r '.project_id')
DEMO_PROJECT_ID=$(cat $DEMO_GCP_KEY | jq -r '.project_id')

# Extract service account emails
DEV_SERVICE_ACCOUNT=$(cat $DEV_GCP_KEY | jq -r '.client_email')
DEMO_SERVICE_ACCOUNT=$(cat $DEMO_GCP_KEY | jq -r '.client_email')

log "DEV Project ID: $DEV_PROJECT_ID"
log "DEMO Project ID: $DEMO_PROJECT_ID"
log "DEV Service Account: $DEV_SERVICE_ACCOUNT"
log "DEMO Service Account: $DEMO_SERVICE_ACCOUNT"
log "Using Zone: $ZONE"

log "Finding the latest compute image in DEV project..."

# Authenticate with DEV project
gcloud auth activate-service-account --key-file=$DEV_GCP_KEY
gcloud config set project $DEV_PROJECT_ID

# Get the latest compute image name with "custom-nodejs-mysql" prefix
COMPUTE_IMAGE_NAME=$(gcloud compute images list --project=$DEV_PROJECT_ID \
  --filter="name~'custom-nodejs-mysql'" \
  --sort-by=~creationTimestamp --limit=1 \
  --format="value(name)")

if [ -z "$COMPUTE_IMAGE_NAME" ]; then
    log "No compute image found with prefix 'custom-nodejs-mysql'. Exiting..."
    exit 1
fi

log "Found latest compute image: $COMPUTE_IMAGE_NAME"

# Generate timestamp for unique resource naming
TIMESTAMP=$(date +%s)
COPIED_COMPUTE_IMAGE_NAME="copy-${COMPUTE_IMAGE_NAME}"
MACHINE_IMAGE_NAME_DEV="mi-${COMPUTE_IMAGE_NAME}"
MACHINE_IMAGE_NAME_DEMO="mi-demo-${COMPUTE_IMAGE_NAME}"

# Grant DEMO project access to DEV compute image
log "Granting DEMO Project ($DEMO_PROJECT_ID) access to Compute Image ($COMPUTE_IMAGE_NAME)..."
gcloud compute images add-iam-policy-binding $COMPUTE_IMAGE_NAME \
    --project=$DEV_PROJECT_ID \
    --member="serviceAccount:$DEMO_SERVICE_ACCOUNT" \
    --role="roles/compute.imageUser"

# Add permission for Terraform to create/use machine images in both projects
log "Ensuring service accounts have proper permissions..."

# Set roles for DEV project
gcloud projects add-iam-policy-binding $DEV_PROJECT_ID \
    --member="serviceAccount:$DEV_SERVICE_ACCOUNT" \
    --role="roles/compute.admin"

# Set roles for DEMO project  
gcloud projects add-iam-policy-binding $DEMO_PROJECT_ID \
    --member="serviceAccount:$DEMO_SERVICE_ACCOUNT" \
    --role="roles/compute.admin"

# Set environment variables for Terraform
export GOOGLE_APPLICATION_CREDENTIALS="$DEV_GCP_KEY"

# Create terraform.tfvars for the Terraform execution
cat > gcp_migration.tfvars << EOF
dev_project_id         = "$DEV_PROJECT_ID"
demo_project_id        = "$DEMO_PROJECT_ID"
zone                   = "$ZONE"
compute_image_name     = "$COMPUTE_IMAGE_NAME"
copied_compute_image_name = "$COPIED_COMPUTE_IMAGE_NAME"
machine_image_name_dev = "$MACHINE_IMAGE_NAME_DEV"
machine_image_name_demo = "$MACHINE_IMAGE_NAME_DEMO"
timestamp              = "$TIMESTAMP"
EOF

log "Created terraform.tfvars with required variables"
log "Ready to execute Terraform for GCP resource creation"