# liran

An on-premise, plug-and-play natural language interface for Node.js applications. Point it at your database, REST API, GraphQL endpoint, or custom functions — your team can query it in plain English, powered by a local LLM. No cloud. No per-query costs. No data leaving your infrastructure.

**Key Features:**
- 🤖 Local LLM inference — runs fully on your hardware via [node-llama-cpp](https://github.com/withcatai/node-llama-cpp)
- 🗣️ Natural language interface over your existing systems
- 🔌 Multiple connection types — database, REST API, GraphQL, or custom functions
- 🔐 Role-based access control — restrict which tools each role can call
- 💾 Session memory — multi-turn conversations backed by Redis
- 🌊 Streaming and buffered response modes
- 👨🏾‍💻 CLI tool for model management
- 🚀 Zero external API calls at inference time

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Configuration File Structure](#configuration-file-structure)
  - [Configuration Options](#configuration-options)
  - [Connection Types](#connection-types)
- [Core Concepts](#core-concepts)
- [API Reference](#api-reference)
- [CLI Commands](#cli-commands)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [License](#license)

---

## Installation

```bash
npm install liran
```

TypeScript types are included by default.

**Prerequisites:**
- Node.js 18+
- Redis (for session storage)
- One of the supported database drivers if using a database connection (`pg`, `mysql2`, or `better-sqlite3` are bundled)

---

## Quick Start

**1. Create a configuration file**

Create `liran.yaml` in your project root:

```yaml
system:
  name: "Acme Corp"
  domain: "inventory management system"

model:
  name: qwen-0.5b

session:
  provider: redis
  redis_url_env: REDIS_URL

connection:
  type: database
  driver: postgres
  host_env: DB_HOST
  port_env: DB_PORT
  name_env: DB_NAME
  user_env: DB_USER
  password_env: DB_PASSWORD

permissions:
  roles:
    admin:
      allowed_tools: "*"

tools:
  - name: get_low_stock
    description: Find products with stock below a given threshold
    params:
      - name: threshold
        type: number
        description: Minimum stock level
        required: true
    query: >-
      SELECT id, name, quantity FROM products WHERE quantity < :threshold ORDER BY quantity ASC
```

**2. Download the model**

```bash
npx liran install
```

**3. Use in your application**

```typescript
import { LiranSDK } from 'liran';

const sdk = new LiranSDK();

const response = await sdk.chat({
  message: "Which products have less than 10 units left?",
  sessionId: "session-abc",
  userId: "user-123",
  role: "admin"
});

console.log(response);
// "There are 3 products with less than 10 units: Widget A (5), Gadget B (2), and Part C (8)."
```

---

## Configuration

### Configuration File Structure

Create `liran.yaml` in your project root. Liran will automatically find and load it.

```yaml
system:
  name: "Your System Name"        # Name of the system (shown to the LLM)
  domain: "what this system does" # Domain description (helps LLM understand context)
  language: en                    # Response language (default: en)

model:
  name: qwen-0.5b                 # Model to use (see available models below)
  context_window: 4096            # Context window size (default: 4096)
  temperature: 0.1                # LLM temperature 0-2 (default: 0.1)

session:
  provider: redis
  ttl: 1800                       # Session TTL in seconds (default: 1800)
  max_history: 10                 # Messages to include in context (default: 10)
  redis_url_env: REDIS_URL        # Name of env var holding the Redis URL

connection:
  type: database                  # function | rest_api | database | graphql
  # ... connection-specific fields (see Connection Types)

permissions:
  roles:
    admin:
      allowed_tools: "*"          # "*" = all tools
    staff:
      allowed_tools:              # Or list specific tool names
        - get_products
        - get_orders

tools:
  - name: tool_name
    description: What this tool does
    params:
      - name: param_name
        type: string              # string | number | boolean
        description: What this param is
        required: true
    # Connection-specific fields below...
```

### Configuration Options

#### System Settings

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `system.name` | string | Yes | — | Name of your system |
| `system.domain` | string | Yes | — | Domain/purpose description |
| `system.language` | string | No | `en` | Language for LLM responses |

#### Model Settings

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `model.name` | string | No | `qwen-0.5b` | Model name (see table below) |
| `model.path` | string | No | — | Path to a custom `.gguf` file (required when `name` is `custom`) |
| `model.context_window` | number | No | `4096` | Context window in tokens |
| `model.temperature` | number | No | `0.1` | Sampling temperature (0–2) |

**Available Models**

| Name | Size | Description |
|------|------|-------------|
| `qwen-0.5b` | ~300 MB | Smallest — fastest, good for simple queries |
| `smollm3-3b` | ~2 GB | Balanced — good accuracy and speed |
| `phi-4-mini` | ~2.5 GB | Strong reasoning, Microsoft's compact model |
| `qwen2.5-7b` | ~4.5 GB | Most capable, slower, needs more RAM |
| `custom` | — | Your own GGUF model, specify `model.path` |

Models are downloaded automatically on first run, or pre-downloaded with `liran install`.

#### Session Settings

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `session.provider` | string | No | `redis` | Session backend (`redis` only currently) |
| `session.ttl` | number | No | `1800` | Session time-to-live in seconds |
| `session.max_history` | number | No | `10` | Max conversation turns kept in memory |
| `session.redis_url_env` | string | No | `REDIS_URL` | Name of env var holding the Redis connection URL |

---

### Connection Types

#### `function` — Custom JavaScript/TypeScript handlers

Register your own async functions as tools. Useful when you need custom logic, access to internal services, or want to call existing methods directly.

```yaml
connection:
  type: function

tools:
  - name: get_user
    description: Fetch a user by ID
    params:
      - name: user_id
        type: string
        description: The user's ID
        required: true
```

```typescript
const sdk = new LiranSDK();

sdk.registerTool('get_user', async (args) => {
  return await db.users.findById(args.user_id);
});
```

> All tools listed in the config must have a registered handler before `sdk.chat()` is called.

---

#### `rest_api` — HTTP endpoints

Query REST APIs directly. Supports path parameters, query strings, and request bodies.

```yaml
connection:
  type: rest_api
  base_url: https://api.yourservice.com
  auth:
    type: bearer            # bearer | api_key
    token_env: API_TOKEN    # Name of env var holding the token

tools:
  - name: get_order
    description: Get an order by ID
    method: GET
    path: /orders/{order_id}
    params:
      - name: order_id
        type: string
        description: Order ID
        required: true
    expose:
      fields: [id, status, total, createdAt]  # Only return these fields

  - name: create_shipment
    description: Create a shipment for an order
    method: POST
    path: /shipments
    params:
      - name: order_id
        type: string
        description: Order to ship
        required: true
      - name: carrier
        type: string
        description: Shipping carrier name
        required: true
```

**Path parameters** — use `{param_name}` in the path; matching params are substituted automatically.

**GET requests** — non-path params become query string parameters.

**POST/PUT/PATCH requests** — non-path params go into the request body as JSON.

---

#### `database` — SQL queries

Run parameterized SQL queries against PostgreSQL, MySQL, or SQLite. Use `:param_name` in queries — they are safely substituted at runtime.

```yaml
connection:
  type: database
  driver: postgres            # postgres | mysql | sqlite
  host_env: DB_HOST
  port_env: DB_PORT
  name_env: DB_NAME
  user_env: DB_USER
  password_env: DB_PASSWORD
  pool:
    min: 2
    max: 10

tools:
  - name: search_products
    description: Search products by name keyword
    params:
      - name: keyword
        type: string
        description: Search term
        required: true
    query: >-
      SELECT id, name, price, quantity
      FROM products
      WHERE name ILIKE :keyword AND deleted_at IS NULL
      LIMIT 20

  - name: get_revenue_by_month
    description: Get total revenue for a given month and year
    params:
      - name: month
        type: number
        description: Month number (1-12)
        required: true
      - name: year
        type: number
        description: Year e.g. 2024
        required: true
    query: >-
      SELECT SUM(amount) AS total_revenue, COUNT(*) AS order_count
      FROM orders
      WHERE EXTRACT(MONTH FROM created_at) = :month
        AND EXTRACT(YEAR FROM created_at) = :year
```

> For SQLite, set `name_env` to the env var holding the path to your `.db` file.

---

#### `graphql` — GraphQL queries and mutations

Send GraphQL operations to any endpoint. Variables are populated from the tool's `params`.

```yaml
connection:
  type: graphql
  endpoint: https://api.yourservice.com/graphql
  auth:
    type: bearer
    token_env: API_TOKEN

tools:
  - name: get_customer
    description: Fetch a customer profile
    params:
      - name: customer_id
        type: string
        description: Customer ID
        required: true
    operation: query
    query: >-
      query GetCustomer($customer_id: ID!) {
        customer(id: $customer_id) {
          id name email plan createdAt
        }
      }
```

---

### Permissions

Control which roles can call which tools.

```yaml
permissions:
  roles:
    admin:
      allowed_tools: "*"          # Access to all tools

    support:
      allowed_tools:
        - get_customer
        - get_order
        - search_products

    analyst:
      allowed_tools:
        - get_revenue_by_month
        - get_order_summary
```

The `role` field passed to `sdk.chat()` is matched against this config. Attempting to call a restricted tool returns an authorization error.

---

### Field Filtering with `expose`

Use `expose.fields` on any tool to whitelist which fields are returned to the LLM. Useful for stripping sensitive data (passwords, tokens, internal IDs) before the response is formatted.

```yaml
tools:
  - name: get_user
    description: Get user details
    # ...
    expose:
      fields: [id, name, email, plan, createdAt]
      # Internal fields like passwordHash, stripeId etc. are stripped
```

---

## Core Concepts

### How It Works

1. **Intent parsing** — the LLM reads the user's message and decides which tool to call and with what arguments (or responds conversationally if no tool applies)
2. **Tool execution** — the router executes the selected tool against your connection (DB, API, etc.)
3. **Response formatting** — the LLM formats the raw data into a natural language answer
4. **Session persistence** — the turn is saved to Redis so future messages have conversation context

### Sessions

Each conversation is identified by a `sessionId`. Messages within the same session share history. Use different `sessionId` values for different conversations or users.

Sessions expire based on `session.ttl` (default 30 minutes of inactivity).

### Roles

The `role` passed to `chat()` is used to enforce tool permissions. Define your roles in `liran.yaml` and pass the authenticated user's role at call time.

```typescript
await sdk.chat({ message, sessionId, userId, role: 'support' });
```

### Conversational Responses

If the user greets the assistant or asks something unrelated to any tool, the LLM responds naturally without executing a tool. No configuration needed.

---

## API Reference

### `LiranSDK`

```typescript
import { LiranSDK } from 'liran';
```

#### Constructor

```typescript
const sdk = new LiranSDK();
const sdk = new LiranSDK('./path/to/liran.yaml'); // optional custom config path
```

Initialization (model loading, Redis connection) starts immediately in the background. The first `chat()` call waits for it to complete.

---

#### `sdk.registerTool(name, handler)`

Register a handler for a `function` connection tool. Must be called before `sdk.chat()` for all tools defined in the config.

```typescript
sdk.registerTool('send_email', async (args) => {
  await mailer.send({ to: args.recipient, subject: args.subject });
  return { sent: true };
});
```

| Param | Type | Description |
|-------|------|-------------|
| `name` | `string` | Tool name — must match name in `liran.yaml` |
| `handler` | `(args: Record<string, unknown>) => Promise<unknown>` | Async function returning the tool result |

---

#### `sdk.chat(options)` → `Promise<string>`

Send a message and get a complete response.

```typescript
const response = await sdk.chat({
  message: "How many orders were placed today?",
  sessionId: "session-abc123",
  userId: "user-456",
  role: "admin"
});
```

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `message` | `string` | Yes | The user's message |
| `sessionId` | `string` | Yes | Conversation session ID |
| `userId` | `string` | Yes | ID of the user sending the message |
| `role` | `string` | Yes | Role used for permission checks |

---

#### `sdk.chatStream(options)` → `AsyncIterable<string>`

Same as `chat()` but streams the response token by token.

```typescript
for await (const token of sdk.chatStream({ message, sessionId, userId, role })) {
  process.stdout.write(token);
}
```

Useful for streaming responses to clients via Server-Sent Events or WebSockets.

---

#### `sdk.start()` → `Promise<void>`

Explicitly wait for the SDK to finish initializing. Optional — `chat()` waits automatically.

```typescript
await sdk.start();
console.log('SDK ready');
```

---

#### `sdk.getStatus()` → `Promise<SDKStatus>`

Get current SDK status.

```typescript
const status = await sdk.getStatus();
// {
//   modelLoaded: true,
//   activeSessions: 3,
//   uptime: 123456,
//   configName: "Acme Corp"
// }
```

---

#### `sdk.getLogs(options?)` → `Promise<QueryLog[]>`

Retrieve query logs. Logs are held in memory for the lifetime of the process.

```typescript
const logs = await sdk.getLogs({ userId: 'user-123', limit: 50 });
```

| Option | Type | Description |
|--------|------|-------------|
| `userId` | `string` | Filter by user ID |
| `toolName` | `string` | Filter by tool called |
| `from` | `Date` | Filter by start time |
| `to` | `Date` | Filter by end time |
| `limit` | `number` | Max results to return |

---

#### `sdk.getConfig()` → `LiranConfig`

Returns the parsed configuration object.

---

## CLI Commands

```bash
liran install [config]   # Download the model specified in liran.yaml
liran models             # List available models and active selection
```

### `liran install`

Downloads the model specified in your `liran.yaml` to `~/.liran-sdk/models/`. Running this before first use avoids a cold-start download delay.

```bash
liran install
# Installing model "qwen-0.5b"...
# Model "qwen-0.5b" installed successfully.
```

Pass a custom config path as an optional argument:

```bash
liran install ./configs/liran.production.yaml
```

### `liran models`

Lists all available models and shows which is currently active (installed and recorded in `~/.liran-sdk/model-state.json`).

```bash
liran models

# Available models:
#
#   qwen-0.5b ✓ (active)
#     hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF/qwen2.5-0.5b-instruct-q4_k_m.gguf
#
#   smollm3-3b
#     hf:HuggingFaceTB/SmolLM3-3B-Instruct-GGUF/smollm3-3b-instruct-q4_k_m.gguf
#   ...
#
# Active: qwen-0.5b
```

---

## Examples

### Express REST API

```typescript
import express from 'express';
import { LiranSDK } from 'liran';

const app = express();
app.use(express.json());

const sdk = new LiranSDK();

app.post('/chat', async (req, res) => {
  const { message, sessionId, userId, role } = req.body;

  try {
    const response = await sdk.chat({ message, sessionId, userId, role });
    res.json({ response });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

app.listen(3000);
```

### Streaming via Server-Sent Events

```typescript
app.get('/chat/stream', async (req, res) => {
  const { message, sessionId, userId, role } = req.query as Record<string, string>;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    for await (const token of sdk.chatStream({ message, sessionId, userId, role })) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write('data: [DONE]\n\n');
  } finally {
    res.end();
  }
});
```

### Function Connection with Custom Logic

```typescript
import { LiranSDK } from 'liran';
import { OrderService } from './services/orders.js';

const sdk = new LiranSDK();
const orders = new OrderService();

sdk.registerTool('get_order', async (args) => {
  return await orders.findById(String(args.order_id));
});

sdk.registerTool('cancel_order', async (args) => {
  await orders.cancel(String(args.order_id));
  return { cancelled: true };
});

const response = await sdk.chat({
  message: "Cancel order #1042",
  sessionId: "session-1",
  userId: "staff-99",
  role: "support"
});
```

### Multi-role Setup

```yaml
# liran.yaml
permissions:
  roles:
    admin:
      allowed_tools: "*"
    support:
      allowed_tools: [get_order, get_customer, search_products]
    finance:
      allowed_tools: [get_revenue, get_payouts, get_payout_summary]
```

```typescript
// Support agent — can only call support tools
await sdk.chat({ message, sessionId, userId, role: 'support' });

// Finance team — can only call finance tools
await sdk.chat({ message, sessionId, userId, role: 'finance' });
```

---

## Troubleshooting

### Redis URL not set

```
InitializationError: Redis URL env var "REDIS_URL" is not set
```

The env var named in `session.redis_url_env` is not present in `process.env`. Load your `.env` file before creating the SDK:

```bash
# Option 1 — Node built-in (Node 20+, no extra packages)
node --env-file=.env server.js

# Option 2 — dotenv
npm install dotenv
```

```typescript
import 'dotenv/config';   // must be first import
import { LiranSDK } from 'liran';
```

---

### Model not found / download fails

```
ModelError: Failed to load model "qwen-0.5b": ENOENT
```

Run `liran install` to pre-download the model. On first run without pre-download, the SDK will attempt to download automatically — ensure you have internet access and enough disk space.

---

### Missing handlers for tools

```
InitializationError: Missing handlers for tools: get_order. Call sdk.registerTool() for each before sdk.chat().
```

For `function` connection type, every tool in the config needs a registered handler:

```typescript
sdk.registerTool('get_order', async (args) => { /* ... */ });
```

---

### No sequences left

```
Error: No sequences left
```

This can occur under heavy concurrent load. The LLM context has a limited pool of sequences. Ensure requests are not queued simultaneously against the same SDK instance. For high-concurrency deployments, scale horizontally with multiple processes.

---

### Database env vars not set

```
ToolError: Database env var "DB_HOST" (host) is not set
```

The env vars referenced in your `connection` config block are not set. Ensure all five database env vars are present: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` (or whatever names you configured).

---

## FAQ

**Q: Does liran send any data to the internet?**

A: Only for model downloads (one-time, from HuggingFace). All inference runs locally. No queries, responses, or user data leave your server.

**Q: Which model should I use?**

A: Start with `qwen-0.5b` for development — it's fast and small. Switch to `smollm3-3b` or `phi-4-mini` for better accuracy in production. Use `qwen2.5-7b` for the most capable responses if hardware permits.

**Q: Can I use a custom model?**

A: Yes. Set `model.name: custom` and `model.path: /path/to/your/model.gguf` in the config. Any GGUF-format model compatible with `node-llama-cpp` will work.

**Q: Can I use multiple connection types at once?**

A: No — one connection type per liran instance. Run separate SDK instances with different configs if you need multiple connection types.

**Q: What happens if the user asks something not covered by any tool?**

A: The LLM responds conversationally without calling a tool. Greetings, off-topic questions, and general conversation are handled naturally.

**Q: Can I use this with JavaScript (not TypeScript)?**

A: Yes. The package ships compiled JS. Import normally:
```js
import { LiranSDK } from 'liran';
// or
const { LiranSDK } = await import('liran'); // from CJS
```

**Q: Is there a limit to how many tools I can define?**

A: No hard limit, but more tools in the config means a longer system prompt. For very large tool sets (20+), consider breaking them across multiple SDK instances by domain.

---

## License

MIT License — see LICENSE file for details.

---

## Support

For issues and questions, please visit the [GitHub repository](https://github.com/Bolu1/liran).
