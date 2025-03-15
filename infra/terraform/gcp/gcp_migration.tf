terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
    null = {
      source  = "hashicorp/null"
      version = "~> 3.0"
    }
  }
}

# Variables
variable "dev_project_id" {
  description = "GCP DEV Project ID"
  type        = string
}

variable "demo_project_id" {
  description = "GCP DEMO Project ID"
  type        = string
}

variable "zone" {
  description = "GCP Zone"
  type        = string
  default     = "us-east1-b"
}

variable "compute_image_name" {
  description = "Source compute image name in DEV project"
  type        = string
}

variable "copied_compute_image_name" {
  description = "Target compute image name in DEMO project"
  type        = string
}

variable "machine_image_name_dev" {
  description = "Machine image name in DEV project"
  type        = string
}

variable "machine_image_name_demo" {
  description = "Machine image name in DEMO project"
  type        = string
}

variable "timestamp" {
  description = "Timestamp for generating unique instance names"
  type        = string
}

# Providers
provider "google" {
  alias   = "dev"
  project = var.dev_project_id
}

provider "google" {
  alias   = "demo"
  project = var.demo_project_id
}

# Local variables
locals {
  machine_type       = "e2-medium"
  storage_location   = "us"
  temp_instance_dev  = "temp-vm-dev-${var.timestamp}"
  temp_instance_demo = "temp-vm-demo-${var.timestamp}"
}

# Copy image to DEMO project
resource "google_compute_image" "copied_image" {
  provider        = google.demo
  name            = var.copied_compute_image_name
  source_image    = "projects/${var.dev_project_id}/global/images/${var.compute_image_name}"
  description     = "Copied from ${var.dev_project_id}/${var.compute_image_name}"
}

# DEV temporary VM
resource "google_compute_instance" "temp_instance_dev" {
  provider     = google.dev
  name         = local.temp_instance_dev
  machine_type = local.machine_type
  zone         = var.zone

  boot_disk {
    initialize_params {
      image = var.compute_image_name
    }
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral IP
    }
  }

  tags = ["allow-ssh"]

  # Required for machine image creation
  metadata = {
    enable-oslogin = "FALSE"
  }
}

# Create a machine image from temp instance in DEV using gcloud CLI
resource "null_resource" "create_machine_image_dev" {
  depends_on = [google_compute_instance.temp_instance_dev]

  provisioner "local-exec" {
    command = <<-EOT
      echo "Creating machine image in DEV project..."
      gcloud compute machine-images create ${var.machine_image_name_dev} \
        --source-instance=${local.temp_instance_dev} \
        --source-instance-zone=${var.zone} \
        --project=${var.dev_project_id} \
        --storage-location=${local.storage_location}
      
      echo "Verifying machine image in DEV project..."
      gcloud compute machine-images describe ${var.machine_image_name_dev} \
        --project=${var.dev_project_id} \
        --format="value(name)"
    EOT
  }
}

# DEMO temporary VM
resource "google_compute_instance" "temp_instance_demo" {
  provider     = google.demo
  name         = local.temp_instance_demo
  machine_type = local.machine_type
  zone         = var.zone

  depends_on = [google_compute_image.copied_image]

  boot_disk {
    initialize_params {
      image = google_compute_image.copied_image.self_link
    }
  }

  network_interface {
    network = "default"
    access_config {
      // Ephemeral IP
    }
  }

  tags = ["allow-ssh"]

  # Required for machine image creation
  metadata = {
    enable-oslogin = "FALSE"
  }
}

# Create a machine image from temp instance in DEMO using gcloud CLI
resource "null_resource" "create_machine_image_demo" {
  depends_on = [
    google_compute_instance.temp_instance_demo,
    null_resource.create_machine_image_dev
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo "Creating machine image in DEMO project..."
      gcloud compute machine-images create ${var.machine_image_name_demo} \
        --source-instance=${local.temp_instance_demo} \
        --source-instance-zone=${var.zone} \
        --project=${var.demo_project_id} \
        --storage-location=${local.storage_location}
      
      echo "Verifying machine image in DEMO project..."
      gcloud compute machine-images describe ${var.machine_image_name_demo} \
        --project=${var.demo_project_id} \
        --format="value(name)"
    EOT
  }
}

# Clean up temporary instances after machine images are created
resource "null_resource" "cleanup" {
  depends_on = [
    null_resource.create_machine_image_dev,
    null_resource.create_machine_image_demo
  ]

  provisioner "local-exec" {
    command = <<-EOT
      echo "Cleaning up temporary instances..."
      
      echo "Deleting temporary VM in DEV project: ${local.temp_instance_dev}"
      gcloud compute instances delete ${local.temp_instance_dev} \
        --project=${var.dev_project_id} \
        --zone=${var.zone} \
        --quiet
      
      echo "Deleting temporary VM in DEMO project: ${local.temp_instance_demo}"
      gcloud compute instances delete ${local.temp_instance_demo} \
        --project=${var.demo_project_id} \
        --zone=${var.zone} \
        --quiet
      
      echo "Resource creation complete! Machine images created in both projects."
      echo "DEV machine image: ${var.machine_image_name_dev}"
      echo "DEMO machine image: ${var.machine_image_name_demo}"
    EOT
  }
}

# Output details
output "copied_image_name" {
  value = google_compute_image.copied_image.name
}

output "dev_machine_image_name" {
  value = var.machine_image_name_dev
}

output "demo_machine_image_name" {
  value = var.machine_image_name_demo
}