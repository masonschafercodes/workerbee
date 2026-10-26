# One Neon project per environment.
#
# The Neon API key comes from NEON_API_KEY in the environment, never from a
# variable, so it never lands in state. The project's database password does land
# in state, and it is the same credential Hyperdrive uses. State is sensitive by
# definition: encrypted bucket, scoped token.
#
# `org_id` is required. The provider docs warn that omitting it can create the
# project in the wrong organization and produce destructive plans later.
#
# `prevent_destroy` is deliberate. `tofu destroy` on an environment must fail
# before it deletes a database. Remove the guard by hand for a real teardown.

terraform {
  required_providers {
    neon = {
      source = "kislerdm/neon"
      # Neon is taking over the provider as neondatabase/neon. When that lands,
      # switch the source deliberately. Never run `tofu init -upgrade` in CI:
      # a major provider change can replace the project and destroy data.
      version = "~> 0.18"
    }
  }
}

variable "name" {
  type = string
}

variable "org_id" {
  type = string
}

variable "region_id" {
  type = string
}

variable "pg_version" {
  type    = number
  default = 17
}

variable "database_name" {
  type    = string
  default = "workerbee"
}

variable "role_name" {
  type    = string
  default = "workerbee"
}

# The free plan caps point-in-time recovery at 6 hours. Raise this when the
# project moves to a paid plan.
variable "history_retention_seconds" {
  type    = number
  default = 21600
}

resource "neon_project" "this" {
  name                      = var.name
  org_id                    = var.org_id
  region_id                 = var.region_id
  pg_version                = var.pg_version
  history_retention_seconds = var.history_retention_seconds
  store_password            = "yes"

  branch {
    name          = "main"
    database_name = var.database_name
    role_name     = var.role_name
  }

  lifecycle {
    prevent_destroy = true
  }
}

output "id" {
  value = neon_project.this.id
}

output "host" {
  value = neon_project.this.database_host
}

output "port" {
  # The direct endpoint always listens on 5432. The pooled endpoint is a
  # different host and is not used: Hyperdrive already pools.
  value = 5432
}

output "database" {
  value = neon_project.this.database_name
}

output "user" {
  value = neon_project.this.database_user
}

output "password" {
  value     = neon_project.this.database_password
  sensitive = true
}

output "connection_uri" {
  value     = neon_project.this.connection_uri
  sensitive = true
}
