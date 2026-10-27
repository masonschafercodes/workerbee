# Label membership rides on the issue change

A label definition is its own entity. Creating, renaming, recoloring, or deleting a label writes a
`label` change with the label's team scope, or null for a workspace label. Attaching or detaching a
label does not write an `issue_label` change. It writes an issue update whose patch contains the
issue's complete `labels` array, plus the new `version` and `updatedAt`.

`issue_label` has no id of its own. It is a pair. A delete change cannot carry a patch, so an
`issue_label` delete would not tell a client which issue and label pair to remove. The issue is the
aggregate root for its labels, and the label list is small enough to send whole.

## Considered options

- **Add `issue_label` to `ENTITY_NAMES`.** The primary key is `(issue_id, label_id)`, which has no
  single entity id to put in a change, and deletes would lose one half of the pair.
- **A delete patch exception.** Loosening the changeset schema for one entity makes every client
  application path more complex, and the schema is shared with agents.
- **Send only label ids on the issue.** The client would need a second lookup table to render a
  chip immediately, and a label that arrives after its attachment would render late.

## Consequences

- Attaching a label bumps the issue version. That is honest: the issue changed.
- Two clients attaching different labels to one issue serialize on the issue row lock, so neither
  attachment is lost.
- A label rename does not touch the issue row. The client refreshes an open issue when a `label`
  change arrives, or re-bootstraps, so names and colors do not go stale.
- Bootstrap carries labels, so a chip can render from an issue patch without another request.
- No protocol bump. `label` was already an entity and the issue patch is additive.
