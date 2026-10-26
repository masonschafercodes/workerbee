variable "account_id" {
  type = string
}

variable "hostname" {
  type = string
}

variable "service" {
  type = string
}

resource "cloudflare_workers_custom_domain" "this" {
  account_id = var.account_id
  hostname   = var.hostname
  service    = var.service
}

output "hostname" {
  value = cloudflare_workers_custom_domain.this.hostname
}
