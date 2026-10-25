terraform {
  required_version = ">= 1.9"

  # Partial configuration on purpose. Point it at the state bucket with:
  #
  #   cp backend.hcl.example backend.hcl
  #   tofu init -backend-config=backend.hcl
  #
  # backend.hcl is ignored by git because it carries R2 credentials.
  backend "s3" {}

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
    neon = {
      source  = "kislerdm/neon"
      version = "~> 0.18"
    }
  }
}

variable "account_id" {
  type = string
}

variable "cloudflare_api_token" {
  type      = string
  sensitive = true
}

variable "neon_org_id" {
  type = string
}

variable "name_prefix" {
  type    = string
  default = "workerbee-dev"
}

variable "r2_location" {
  type    = string
  default = "WEUR"
}

variable "neon_region" {
  type    = string
  default = "aws-eu-central-1"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

# NEON_API_KEY comes from the environment. Do not add it as a variable.
provider "neon" {}

module "attachments" {
  source = "../../modules/storage"

  account_id = var.account_id
  name       = "${var.name_prefix}-attachments"
  location   = var.r2_location
}

module "exports" {
  source = "../../modules/storage"

  account_id = var.account_id
  name       = "${var.name_prefix}-exports"
  location   = var.r2_location
}

module "sync_queue" {
  source = "../../modules/queue"

  account_id = var.account_id
  name       = "${var.name_prefix}-sync"
}

module "dead_letter_queue" {
  source = "../../modules/queue"

  account_id = var.account_id
  name       = "${var.name_prefix}-dead-letter"
}

module "postgres" {
  source = "../../modules/postgres-neon"

  name      = "${var.name_prefix}-postgres"
  org_id    = var.neon_org_id
  region_id = var.neon_region
}

module "hyperdrive" {
  source = "../../modules/hyperdrive"

  account_id = var.account_id
  name       = "${var.name_prefix}-postgres"
  host       = module.postgres.host
  port       = module.postgres.port
  database   = module.postgres.database
  user       = module.postgres.user
  password   = module.postgres.password
}

output "queue_names" {
  value = {
    sync        = module.sync_queue.name
    dead_letter = module.dead_letter_queue.name
  }
}

output "bucket_names" {
  value = {
    attachments = module.attachments.name
    exports     = module.exports.name
  }
}

output "database" {
  value = {
    project_id = module.postgres.id
    host       = module.postgres.host
    name       = module.postgres.database
    user       = module.postgres.user
    region     = var.neon_region
  }
}

output "hyperdrive_id" {
  value = module.hyperdrive.id
}
