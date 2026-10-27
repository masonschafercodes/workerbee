import { describe, expect, test } from "bun:test"
import { assertReadOnly, assertSingleStatement } from "./db"

describe("assertReadOnly", () => {
  test("accepts ordinary reads", () => {
    for (const sql of [
      "select 1",
      "select count(*) from issue",
      "with counts as (select team_id from issue) select * from counts",
      "show server_version",
      "select * from issue;",
    ]) {
      expect(() => assertReadOnly(sql)).not.toThrow()
    }
  })

  test("refuses writes", () => {
    for (const sql of [
      "delete from issue",
      "update issue set title = 'x'",
      "with doomed as (delete from issue returning id) select * from doomed",
      "insert into issue default values",
      "select * from issue for update",
      "select pg_terminate_backend(pid) from pg_stat_activity",
      "select nextval('issue_seq')",
    ]) {
      expect(() => assertReadOnly(sql)).toThrow()
    }
  })

  test("refuses multiple statements", () => {
    expect(() => assertSingleStatement("select 1; select 2")).toThrow()
  })
})
