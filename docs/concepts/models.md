# Models

Models define your data structures using YAML. tuvl automatically generates SQLModel classes, Pydantic schemas, and CRUD API endpoints.

## Model Definition

```yaml title="models/contact.yaml"
kind: "ModelDefinition"
version: "v1"
metadata:
  name: "Contact"
spec:
  tablename: "contacts"
  fields:
    - name: "id"
      type: "uuid"
      primary_key: true
      default: "uuid4"
      input: false
      description: "Unique identifier"

    - name: "email"
      type: "string"
      unique: true
      required: true
      input: true
      description: "Contact email address"

    - name: "name"
      type: "string"
      required: true
      input: true

    - name: "company"
      type: "string"
      input: true

    - name: "created_at"
      type: "timestamp"
      input: false
```

## Field Types

| Type | Python Type | PostgreSQL Type |
|------|-------------|-----------------|
| `string` | `str` | `VARCHAR` |
| `text` | `str` | `TEXT` |
| `integer` | `int` | `INTEGER` |
| `bigint` | `int` | `BIGINT` |
| `smallint` | `int` | `SMALLINT` |
| `float` | `float` | `FLOAT` |
| `numeric` | `float` | `NUMERIC` |
| `boolean` | `bool` | `BOOLEAN` |
| `uuid` | `uuid.UUID` | `UUID` |
| `date` | `datetime.date` | `DATE` |
| `timestamp` | `datetime.datetime` | `TIMESTAMP` |
| `timestamptz` | `datetime.datetime` | `TIMESTAMPTZ` |
| `jsonb` | `dict` | `JSONB` |
| `bytea` | `bytes` | `BYTEA` |

## Field Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | Required | Field name |
| `type` | string | Required | Data type |
| `primary_key` | bool | `false` | Is this the primary key? |
| `required` | bool | `false` | Is this field required? |
| `unique` | bool | `false` | Must values be unique? |
| `index` | bool | `false` | Create an index? |
| `default` | any | `null` | Default value |
| `input` | bool | `true` | Include in Create schema? |
| `secure` | bool | `false` | Mark as PII — value replaced with `"*****"` in OTel span context snapshots |
| `description` | string | `""` | Field description |

## Controlling CRUD Generation (`spec.schema`)

`spec.schema` controls whether tuvl generates Pydantic schemas and mounts CRUD API routes for the model.

| Value | Behaviour |
|-------|-----------|
| `true` (default) | Schemas and CRUD routes (`POST / GET / PATCH / DELETE`) are generated automatically |
| `false` | Table is created in the database, but **no Pydantic schemas and no CRUD endpoints** are exposed. Use this for internal / join tables that are only accessed via workflow steps. |

```yaml
spec:
  tablename: "audit_logs"
  schema: false   # table exists in DB, no REST endpoints generated
  fields:
    ...
```

!!! tip
    The `tuvl init --sample` scaffold sets `schema: false` on the sample model intentionally.
    When you create your own model from the template, change this to `schema: true` (or remove the
    line entirely — `true` is the default) to have CRUD endpoints generated automatically.

At the model level, `spec.datasource` routes the model to a named datasource (defaults to `"main_postgres"`):

```yaml
spec:
  tablename: "orders"
  datasource: "orders_db"   # matches metadata.name in datasources/orders_db.yaml
  fields: ...

## Default Values

### Static Defaults

```yaml
- name: "status"
  type: "string"
  default: "pending"

- name: "priority"
  type: "integer"
  default: 0
```

### Auto-Generated Defaults

| Type | Default | Behavior |
|------|---------|----------|
| `uuid` | `"uuid4"` | Generate UUID v4 |
| `uuid` | (none) | Generate UUID v4 |
| `date` | (none) | Current date |
| `timestamp` | (none) | Current datetime |
| `timestamptz` | (none) | Current datetime |

```yaml
# All of these auto-generate values:
- name: "id"
  type: "uuid"
  primary_key: true
  default: "uuid4"

- name: "created_at"
  type: "timestamp"
  # No default needed - auto-generates
```

## Schema Generation

Three Pydantic schemas are automatically generated for every model:

### Create Schema

Used for POST requests. Includes fields with `input: true`:

```python
class ContactCreate(BaseModel):
    email: str
    name: str
    company: Optional[str] = None
```

### Read Schema

Used for responses. Includes all fields:

```python
class ContactRead(BaseModel):
    id: UUID
    email: str
    name: str
    company: Optional[str]
    created_at: datetime
```

### Update Schema

Used for PATCH requests. All fields optional:

```python
class ContactUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None
```

## Input vs Output Fields

The `input` property controls schema inclusion:

```yaml
fields:
  # Server-generated, never from client
  - name: "id"
    type: "uuid"
    primary_key: true
    input: false          # Not in Create schema

  # Client-provided
  - name: "email"
    type: "string"
    required: true
    input: true           # In Create schema

  # Server-computed
  - name: "score"
    type: "float"
    input: false          # Not in Create schema
```

## Relationships

Declare relations in `spec.relations` to enable expanded read responses and `model-op` steps with `include:`.

```yaml title="models/application.yaml"
kind: "ModelDefinition"
version: "v1"
metadata:
  name: "Application"
spec:
  tablename: "applications"
  fields:
    - name: "id"
      type: "uuid"
      primary_key: true
    - name: "candidate_id"
      type: "uuid"
      required: true
    - name: "role"
      type: "string"
      required: true
  relations:
    - name: "candidate"         # key in the expanded response
      model: "Candidate"        # MODEL_REGISTRY name of the related model
      foreign_key: "candidate_id"   # FK column on THIS model
      type: "many_to_one"       # many_to_one | one_to_many
```

### Relation Types

| Type | FK column lives on | Use case |
|------|--------------------|----------|
| `many_to_one` | This model | `application.candidate_id → candidates.id` |
| `one_to_many` | Related model | `assessments.application_id → applications.id` |

Expanded reads (via `GET /api/application/{id}?include=candidate` or a `model-op` step with `include: candidate`) return nested objects:

```json
{
  "id": "...",
  "role": "Senior Engineer",
  "candidate": {
    "id": "...",
    "name": "Jane Doe",
    "email": "jane@example.com"
  }
}
```

## Generated CRUD API

Each model automatically gets CRUD endpoints:

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/{model}` | Create new record |
| `GET` | `/api/{model}` | List records |
| `GET` | `/api/{model}/{id}` | Get single record |
| `PATCH` | `/api/{model}/{id}` | Update record |
| `DELETE` | `/api/{model}/{id}` | Delete record |

### Example Requests

**Create:**
```bash
curl -X POST http://localhost:8000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"email": "jane@example.com", "name": "Jane Doe"}'
```

**List with filters:**
```bash
curl "http://localhost:8000/api/contact?company=Acme&limit=10"
```

**Update:**
```bash
curl -X PATCH http://localhost:8000/api/contact/uuid-here \
  -H "Content-Type: application/json" \
  -d '{"company": "New Company"}'
```

## Using Models in Workflows

Reference models in workflow context:

```yaml
kind: "Workflow"
version: "v1"
metadata:
  name: "create_contact"

spec:
  context: "Contact"           # Links to Contact model

  trigger:
    path: "/api/contacts/intake"
    method: "POST"
    input_schema: "context"    # Uses ContactCreate
    response_schema: "context" # Uses ContactRead
```

## Model Versioning

Multiple versions of the same model can coexist inside a single YAML file (using `---`
multi-document separation) or across separate files.

### Declaring a version

Add `metadata.schema_version` to tag a model definition:

```yaml title="models/candidate.yaml"
kind: "ModelDefinition"
metadata:
  name: "Candidate"
  schema_version: "v1"        # default when omitted
spec:
  tablename: "candidates"
  fields:
    - name: "id"
      type: "uuid"
      primary_key: true
      default: "uuid4"
      input: false
    - name: "name"
      type: "string"
      required: true

---

kind: "ModelDefinition"
metadata:
  name: "Candidate"
  schema_version: "v2"        # new version in same file
enabled: false                 # inactive until explicitly enabled
spec:
  tablename: "candidates"
  fields:
    - name: "id"
      type: "uuid"
      primary_key: true
      default: "uuid4"
      input: false
    - name: "name"
      type: "string"
      required: true
    - name: "tags"             # field added in v2
      type: "jsonb"
      input: true
```

`schema_version` defaults to `"v1"` when not specified.

### The `enabled` flag

| Value | Behaviour |
|-------|-----------|
| `true` (default) | Model is registered and active |
| `false` | Model is tracked in `MODEL_VERSION_REGISTRY` for admin purposes but excluded from `MODEL_REGISTRY`; no CRUD endpoints are mounted |

Disabled versions are still visible in the admin panel and can be activated without a
server restart via the admin API.

### Admin API

The admin endpoints let you list, enable/disable, and fork model versions at runtime
without editing YAML or restarting the server.

See [Admin Version Management API](../api/endpoints.md#version-management-admin-api) for the full endpoint reference.

### Forking a version

The fork endpoint creates a new YAML file in `models/` pre-stamped with the new
`schema_version`. Use it to branch off a released version for iterative changes:

```bash
# Create models/candidate_v3.yaml from v2
POST /admin/models/Candidate/v2/fork
{ "new_version": "v3" }
```

### Pinning a model version in a workflow

To use a specific model version inside a workflow step, declare the version target in
the `context.models` list:

```yaml
context:
  models:
    - name: "Candidate"
      version: "v2"     # pin to v2 at execution time
```

See [Workflow context format](workflows.md#context-model) for details.

## Model Registry

At runtime, models are stored in `MODEL_REGISTRY`:

```python
from tuvl.core.models.loader import MODEL_REGISTRY

# Access the SQLModel class
ContactModel = MODEL_REGISTRY["Contact"]

# Create an instance
contact = ContactModel(email="test@example.com", name="Test")
```

The `MODEL_VERSION_REGISTRY` contains **all** versions regardless of `enabled` state:

```python
from tuvl.core.models.loader import MODEL_VERSION_REGISTRY

# {name → {schema_version → raw config dict}}
candidate_v2_config = MODEL_VERSION_REGISTRY["Candidate"]["v2"]
```

## Schema Registry

Pydantic schemas are in `SCHEMA_REGISTRY`:

```python
from tuvl.core.models.schemas import SCHEMA_REGISTRY

schemas = SCHEMA_REGISTRY["Contact"]
# {
#   "create": ContactCreate,
#   "read": ContactRead,
#   "update": ContactUpdate,
# }
```

## Best Practices

### 1. Use Descriptive Names

```yaml
# Good
metadata:
  name: "CustomerOrder"

# Avoid
metadata:
  name: "Order1"
```

### 2. Always Set `input` Flag

Be explicit about server vs client fields:

```yaml
- name: "created_by"
  type: "uuid"
  input: false    # Server sets this
```

### 3. Add Descriptions

Help API consumers understand your schema:

```yaml
- name: "priority"
  type: "integer"
  default: 0
  description: "0=low, 1=medium, 2=high, 3=urgent"
```

### 4. Use Appropriate Types

```yaml
# Use uuid for IDs
- name: "id"
  type: "uuid"

# Use timestamptz for datetime with timezone
- name: "event_time"
  type: "timestamptz"

# Use jsonb for flexible data
- name: "metadata"
  type: "jsonb"
```

## Next Steps

- [Repositories](repositories.md) — Accessing data in nodes
- [Workflows](workflows.md) — Using models in workflows
- [Datasources](../configuration/datasources.md) — Database configuration
