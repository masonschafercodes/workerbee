variable "account_id" {
  type = string
}

variable "name" {
  type = string
}

resource "cloudflare_queue" "this" {
  account_id = var.account_id
  queue_name = var.name
}

output "id" {
  value = cloudflare_queue.this.queue_id
}

output "name" {
  value = cloudflare_queue.this.queue_name
}
