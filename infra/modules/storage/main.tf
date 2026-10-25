variable "account_id" {
  type = string
}

variable "name" {
  type = string
}

variable "location" {
  type    = string
  default = "WEUR"
}

resource "cloudflare_r2_bucket" "this" {
  account_id = var.account_id
  name       = var.name
  location   = var.location
}

output "name" {
  value = cloudflare_r2_bucket.this.name
}
