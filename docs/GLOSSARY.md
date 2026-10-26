# Workerbee

A self-hosted issue tracker where humans and agents do work in the same place.

## Language

**Workspace**:
The tenant. A group of people and agents that share teams, issues, and settings. One deployment
can hold several workspaces, and an actor can belong to more than one.
_Avoid_: Organization, account, tenant

**Actor**:
Anything that can be assigned work or write to an issue. An actor is either a human or an agent.
_Avoid_: User (for the general case), member, principal

**Agent**:
A non-human actor with its own credentials, scopes, and budget.
_Avoid_: Bot, teammate, assistant

**Team**:
A group inside a workspace that owns issues and workflow states. An issue belongs to exactly one
team.
_Avoid_: Project, squad

**Issue**:
A unit of work with a title, state, assignee, and history.
_Avoid_: Ticket, task, card

**Identifier**:
The human-facing key of an issue, formed from the team key and the issue number, such as
`ENG-123`. Unique within a workspace.
_Avoid_: Key, ref, slug

**Workflow state**:
A named stage in a team's process, with a category of backlog, unstarted, started, done, or
canceled.
_Avoid_: Status, column

**Changeset**:
The set of changes one write transaction produced. Clients apply a changeset as a unit or not at
all.
_Avoid_: Event, mutation, delta

**Seq**:
The workspace-wide counter that orders changesets. A client that knows its seq can ask for
everything after it.
_Avoid_: Version (reserved for a single record), offset, cursor

**Context bundle**:
A token-bounded rendering of everything an agent needs to know about one issue.
_Avoid_: Payload, prompt

**Wakeup**:
A signal to an agent that work is waiting for it.
_Avoid_: Notification (that is for humans), ping, trigger

**Run**:
One agent attempt at an issue, with a budget and a log. A run ends when the agent reports a
result, the budget is spent, or a human stops it.
_Avoid_: Job, session, task
