packer {
  required_plugins {
    googlecompute = {
      source  = "github.com/hashicorp/googlecompute"
      version = ">= 1.0.0"
    }
    amazon-ebs = {
      source  = "github.com/hashicorp/amazon"
      version = ">= 1.0.0"
    }
  }
}

# GCP Variables
variable "cloud_gcp_base_image" {
  type    = string
  default = "ubuntu-2404-noble-amd64-v20250214"
}

variable "cloud_gcp_source_project" {
  type        = string
  default     = "dev-project-452007"
  description = "GCP DEV project ID"
}

variable "cloud_gcp_target_project" {
  type        = string
  default     = ""
  description = "GCP DEMO project ID to share the image with"
}

variable "cloud_gcp_vm_type" {
  type    = string
  default = "e2-medium"
}

variable "cloud_gcp_region_zone" {
  type    = string
  default = "us-east1-b"
}

variable "cloud_gcp_image_location" {
  type    = string
  default = "us"
}

# AWS Variables
variable "cloud_aws_base_ami" {
  type    = string
  default = "ami-0609a4e88e9e5a526" // Ubuntu 24.04 LTS
}

variable "cloud_aws_region" {
  type    = string
  default = "us-east-1"
}

variable "vm_size" {
  type    = string
  default = "t2.micro"
}

variable "target_account_id" {
  type        = string
  default     = ""
  description = "AWS account ID to share the AMI with"
}

# GCP Image Build
source "googlecompute" "ubuntu" {
  project_id           = var.cloud_gcp_source_project
  source_image         = var.cloud_gcp_base_image
  machine_type         = var.cloud_gcp_vm_type
  zone                 = var.cloud_gcp_region_zone
  image_name           = "custom-nodejs-mysql-{{timestamp}}"
  image_family         = "custom-images"
  image_description    = "Custom GCP image with Node.js and MySQL"
  ssh_username         = "ubuntu"
  wait_to_add_ssh_keys = "10s"
}

# AWS AMI Build
source "amazon-ebs" "ubuntu" {
  region                      = var.cloud_aws_region
  source_ami                  = var.cloud_aws_base_ami
  instance_type               = var.vm_size
  ssh_username                = "ubuntu"
  ami_name                    = "custom-nodejs-mysql-{{timestamp}}"
  ami_description             = "Custom image with Node.js binary and MySQL"
  associate_public_ip_address = true
  ssh_timeout                 = "10m"

  # Share AMI with the DEMO account
  ami_users = [var.target_account_id]
}

build {
  sources = [
    "source.googlecompute.ubuntu",
    "source.amazon-ebs.ubuntu"
  ]

  provisioner "file" {
    source      = "dist/webapp"
    destination = "/tmp/webapp"
  }

  provisioner "file" {
    source      = "webapp.service"
    destination = "/tmp/webapp.service"
  }

  provisioner "file" {
    source      = "setup.sh"
    destination = "/tmp/setup.sh"
  }

  provisioner "shell" {
    inline = [
      "chmod +x /tmp/setup.sh",
      "sudo /tmp/setup.sh"
    ]
  }
}