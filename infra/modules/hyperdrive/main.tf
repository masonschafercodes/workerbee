variable "account_id" {
  type = string
}

variable "name" {
  type = string
}

variable "host" {
  type = string
}

variable "port" {
  type    = number
  default = 5432
}

variable "database" {
  type = string
}

variable "user" {
  type = string
}

variable "password" {
  type      = string
  sensitive = true
}

# Query caching is disabled. This app must read its own writes, and a cached
# SELECT would hand a client a stale row right after a changeset.
resource "cloudflare_hyperdrive_config" "this" {
  account_id = var.account_id
  name       = var.name

  origin = {
    scheme   = "postgres"
    host     = var.host
    port     = var.port
    database = var.database
    user     = var.user
    password = var.password
  }

  caching = {
    disabled = true
  }
}

output "id" {
  value = cloudflare_hyperdrive_config.this.id
}

output "name" {
  value = cloudflare_hyperdrive_config.this.name
}
