# API Schemas

tuvl automatically generates Pydantic schemas from your model definitions.

## Schema Variants

Each model generates three schema variants:

### Create Schema

Used for POST requests. Includes fields where `input: true`:

```python
class ContactCreate(BaseModel):
    email: str                      # required=true, input=true
    name: str                       # required=true, input=true
    company: Optional[str] = None   # input=true, not required
```

### Read Schema

Used for responses. Includes all fields:

```python
class ContactRead(BaseModel):
    id: UUID                        # primary_key
    email: str
    name: str
    company: Optional[str]
    created_at: datetime            # auto-generated
```

### Update Schema

Used for PATCH requests. All fields are optional:

```python
class ContactUpdate(BaseModel):
    email: Optional[str] = None
    name: Optional[str] = None
    company: Optional[str] = None
```

## Schema Registry

Schemas are stored in `SCHEMA_REGISTRY`:

```python
from tuvl_engine.models.schemas import SCHEMA_REGISTRY

# Access Contact schemas
contact_schemas = SCHEMA_REGISTRY["Contact"]
# {
#   "create": ContactCreate,
#   "read": ContactRead,
#   "update": ContactUpdate
# }

# Use a specific variant
CreateSchema = SCHEMA_REGISTRY["Contact"]["create"]
```

## Workflow Schema Resolution

Workflows reference schemas via the `input_schema` and `response_schema` fields:

### Using Context Model

```yaml
context: "Contact"
trigger:
  input_schema: "context"     # Uses Contact.create
  response_schema: "context"  # Uses Contact.read
```

### Explicit Model.Variant

```yaml
trigger:
  input_schema: "Contact.create"
  response_schema: "Contact.read"
```

### Inline Schema

```yaml
trigger:
  input_schema:
    - name: "email"
      type: "string"
      required: true
    - name: "message"
      type: "string"
```

Generates:

```python
class WebhookInput(BaseModel):
    email: str
    message: Optional[str] = None
```

### List Schemas

For bulk operations:

```yaml
trigger:
  input_schema: "list[Contact.create]"
  response_schema: "list[Contact.read]"
```

## Type Mappings

| YAML Type | Python Type | JSON Schema |
|-----------|-------------|-------------|
| `string` | `str` | `string` |
| `text` | `str` | `string` |
| `integer` | `int` | `integer` |
| `float` | `float` | `number` |
| `boolean` | `bool` | `boolean` |
| `uuid` | `UUID` | `string (uuid)` |
| `date` | `date` | `string (date)` |
| `timestamp` | `datetime` | `string (date-time)` |
| `jsonb` | `dict` | `object` |

## Validation

Schemas are validated automatically:

### Request Validation

```bash
# Missing required field
curl -X POST http://localhost:8000/api/contact \
  -d '{"company": "Acme"}'

# Response: 422
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "Field required",
      "type": "missing"
    }
  ]
}
```

### Type Validation

```bash
# Wrong type
curl -X POST http://localhost:8000/api/contact \
  -d '{"email": 123, "name": "Jane"}'

# Response: 422
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "Input should be a valid string",
      "type": "string_type"
    }
  ]
}
```

## Custom Validation

For advanced validation, define custom Pydantic validators in your nodes:

```python
from pydantic import field_validator

# In a custom schema
class OrderCreate(BaseModel):
    quantity: int
    
    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v):
        if v <= 0:
            raise ValueError("Quantity must be positive")
        return v
```

## OpenAPI Generation

View generated schemas at `/openapi.json`:

```json
{
  "components": {
    "schemas": {
      "ContactCreate": {
        "type": "object",
        "required": ["email", "name"],
        "properties": {
          "email": {"type": "string"},
          "name": {"type": "string"},
          "company": {"type": "string", "nullable": true}
        }
      },
      "ContactRead": {
        "type": "object",
        "properties": {
          "id": {"type": "string", "format": "uuid"},
          "email": {"type": "string"},
          "name": {"type": "string"},
          "company": {"type": "string", "nullable": true},
          "created_at": {"type": "string", "format": "date-time"}
        }
      }
    }
  }
}
```

## Next Steps

- [Models](../concepts/models.md) — Defining models
- [Endpoints](endpoints.md) — API endpoint reference
