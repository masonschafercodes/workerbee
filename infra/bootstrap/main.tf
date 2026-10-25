# Run once, by hand, with a local state file:
#
#   cd infra/bootstrap
#   tofu init
#   tofu apply -var="account_id=$CLOUDFLARE_ACCOUNT_ID"
#
# This creates the bucket that holds every other environment's state. It uses
# local state on purpose: there is nowhere else to put the first state file.
#
# After apply, create an R2 API token with object read and write on this bucket
# and put its credentials in the environment that runs `tofu init` elsewhere.
# Tokens are account-scoped, so creating one is a dashboard action, not a tofu
# resource. That is the only manual step in the bootstrap.

terraform {
  required_version = ">= 1.9"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
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

variable "state_bucket" {
  type    = string
  default = "workerbee-tofu-state"
}

variable "location" {
  type    = string
  default = "WEUR"
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}

resource "cloudflare_r2_bucket" "state" {
  account_id = var.account_id
  name       = var.state_bucket
  location   = var.location

  lifecycle {
    prevent_destroy = true
  }
}

output "state_bucket" {
  value = cloudflare_r2_bucket.state.name
}
