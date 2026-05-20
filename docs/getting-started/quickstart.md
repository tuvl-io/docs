# Quickstart

Build your first AI-powered workflow in under 5 minutes.

## Create a New Project

```bash
# Minimal scaffold
tuvl init my-app

# Recommended: include sample workflow, nodes, tests, and telemetry config
tuvl init my-app --sample

cd my-app
```

!!! tip
    `--sample` writes a ready-to-run recruitment screening workflow, two LLM-as-a-Judge test cases, and a `.tuvl/telemetry.yaml` config. It's the fastest way to see every feature in action.

This creates the following structure:

```
my-app/
├── models/           # Data model definitions
├── workflows/        # Workflow definitions
├── datasources/      # Database configurations
├── llms/             # LLM agent presets
├── nodes/            # Python node implementations
├── .tuvl/
│   └── telemetry.yaml  # OTel config (--sample)
├── tests/
│   └── workflows/      # Test cases (--sample)
├── .env              # Environment variables
└── .env.example      # Safe-to-commit template
```

## Define a Model

Create a simple `Contact` model:

```yaml title="models/contact.yaml"
kind: "ModelDefinition"
version: "v1"
metadata:
  name: "Contact"
spec:
  tablename: "contacts"
  schema: true
  fields:
    - name: "id"
      type: "uuid"
      primary_key: true
      default: "uuid4"
      input: false

    - name: "email"
      type: "string"
      unique: true
      required: true
      input: true

    - name: "name"
      type: "string"
      required: true
      input: true

    - name: "company"
      type: "string"
      input: true

    - name: "priority"
      type: "string"
      input: false
      description: "AI-assigned priority level"
```

## Create a Node

Nodes are Python functions that process the workflow context:

```python title="nodes/contact_nodes.py"
from typing import Any
from tuvl_engine.nodes.base import node
from tuvl_engine.repositories.registry import get_repository

@node("save_contact")
async def save_contact(ctx: dict[str, Any]) -> dict[str, Any]:
    """Save a new contact to the database."""
    session = ctx["_session"]
    repo = get_repository("Contact", session)
    
    contact = await repo.add({
        "email": ctx["email"],
        "name": ctx["name"],
        "company": ctx.get("company"),
    })
    
    ctx["id"] = str(contact.id)
    ctx["status"] = "saved"
    return ctx


@node("enrich_contact")
async def enrich_contact(ctx: dict[str, Any]) -> dict[str, Any]:
    """Update contact with AI-enriched data."""
    session = ctx["_session"]
    repo = get_repository("Contact", session)
    
    await repo.update(ctx["id"], {
        "priority": ctx.get("priority", "normal"),
    })
    
    ctx["status"] = "enriched"
    return ctx
```

## Define a Workflow

Create a workflow that saves a contact and uses AI to prioritize them:

```yaml title="workflows/contact_intake.yaml"
kind: "Workflow"
metadata:
  name: "contact_intake"
  description: "Capture and prioritize new contacts"

context: "Contact"

trigger:
  path: "/api/contacts"
  method: "POST"
  input_schema: "context"
  response_schema: "context"

steps:
  - id: "save"
    kind: "functional"
    runner: "save_contact"

  - id: "prioritize"
    kind: "agent"
    agent:
      model: "ollama/llama3"
      system: |
        You are a lead scoring assistant. Analyze the contact
        and assign a priority level.
      prompt: |
        Contact: {{ name }}
        Email: {{ email }}
        Company: {{ company }}
        
        Respond with JSON: {"priority": "high" | "medium" | "low"}
      output:
        format: json
        map:
          priority: priority
    routes:
      default: "enrich"
      error: "enrich"

  - id: "enrich"
    kind: "functional"
    runner: "enrich_contact"
```

## Configure the Database

Edit `.env` with your PostgreSQL credentials:

```env title=".env"
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=tuvl
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

## Run the Server

```bash
# Start dev server in current directory
tuvl dev

# Specify a different port or project directory
tuvl dev --port 3000
tuvl dev --project-dir ./services/api
```

The dev server starts on `http://localhost:8000` with the built-in tuvl insight UI at `http://localhost:8000/ui/`. A one-time security key is printed on startup — paste it into the UI to authenticate.

```
╭─────────────────────────────── tuvl dev ───────────────────────────────╮
│ Starting tuvl engine in dev mode on port 8000.                         │
│                                                                        │
│ Security key                                                           │
│  XXXX-XXXX-XXXX-XXXX                                                   │
│                                                                        │
│ Open http://127.0.0.1:8000/ui/ and paste the key above.               │
╰────────────────────────────────────────────────────────────────────────╯
```

## Test Your Workflow

Send a request to your new endpoint:

```bash
curl -X POST http://localhost:8000/api/contacts \
  -H "Content-Type: application/json" \
  -d '{
    "email": "jane@example.com",
    "name": "Jane Doe",
    "company": "Acme Corp"
  }'
```

Response:

```json
{
  "success": true,
  "status_code": 200,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "company": "Acme Corp",
    "priority": "high",
    "status": "enriched"
  },
  "error": null
}
```

## Explore the API

Open `http://localhost:8000/ui/` and paste the security key to access the tuvl insight developer portal, where you can:

- Browse and test all your workflow endpoints
- Inspect live step events and execution traces
- Manage models, datasources, and LLM providers visually

The raw OpenAPI schema is also available at `http://localhost:8000/docs`.

## What's Next?

<div class="grid cards" markdown>

-   :material-sitemap:{ .lg .middle } **Understand Workflows**

    ---

    Learn about step kinds, routing, and advanced patterns.

    [:octicons-arrow-right-24: Workflows](../concepts/workflows.md)

-   :material-code-braces:{ .lg .middle } **Build Custom Nodes**

    ---

    Create powerful reusable logic units.

    [:octicons-arrow-right-24: Nodes](../concepts/nodes.md)

-   :material-robot:{ .lg .middle } **Configure AI Agents**

    ---

    Set up LLM providers and prompts.

    [:octicons-arrow-right-24: Agents](../configuration/agents.md)

-   :material-database:{ .lg .middle } **Work with Data**

    ---

    Learn the repository pattern and model definitions.

    [:octicons-arrow-right-24: Repositories](../concepts/repositories.md)

</div>
