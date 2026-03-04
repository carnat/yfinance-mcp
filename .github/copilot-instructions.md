# Copilot Instructions for yfinance-mcp

## Project Overview
Cloudflare Workers MCP (Model Context Protocol) server exposing Yahoo Finance stock data through stateful tool invocations. Uses Durable Objects to maintain persistent SSE connections.

## Architecture Decisions

### Durable Objects for Statefulness
The MCP protocol requires maintaining stateful SSE connections. We use Cloudflare Durable Objects (`WorkerEntrypoint` pattern) rather than serverless functions because:
- SSE requires a persistent connection for bidirectional messaging
- Durable Objects provide in-memory state across multiple requests
- Single instance per namespace (via `idFromName("default")`) ensures one MCP server

### Tool Registration
All MCP tools are registered in `YahooMcpServer.initializeTools()` as a Map:
- Tools are stored in `this.tools.Map<string, handler>`
- Handlers receive arguments directly and return string results
- Errors return error messages as strings (no exception throwing)
- Handler signature: `async (args: any) => Promise<string>`

### SSE & JSON-RPC Flow
1. Client connects to `/sse` endpoint → establishes `SSEServerTransport`
2. Client sends JSON-RPC methods to `/messages` POST endpoint
3. Transport routes to tool handlers, responds via SSE stream

## File Structure
```
src/index.ts         # YahooMcpServer Durable Object + tool implementations
wrangler.jsonc       # Durable Object binding, compatibility flags, migrations
package.json         # Dependencies (sdk, yahoo-finance2, zod)
tsconfig.json        # ES2022 target for Node.js compat
.devcontainer/       # Dev environment with Cloudflare Workers extension
```

## Key Dependencies & Why
- `@modelcontextprotocol/sdk`: MCP server/transport implementation
- `yahoo-finance2`: Financial data fetching (requires Node.js compat)
- `zod`: Input validation for tool parameters

## Development Workflow

### Installation & Setup
```bash
npm ci                           # Install dependencies
npm run dev                      # Start Wrangler dev server on port 8787
# In another terminal:
curl http://localhost:8787/sse  # Verify SSE endpoint
```

### Local Testing
- Wrangler dev emulates Durable Objects locally
- SSE connection persists across requests within the session
- Test with HTTP client (curl/Postman) sending JSON-RPC to `/messages`

### Deployment
```bash
wrangler deploy                  # Deploy to Cloudflare (requires account + API token)
```

## Adding New Tools
1. Add a new entry to `this.tools.set()` in `initializeTools()` method
2. Tool name becomes the key, handler function is the value
3. Handler receives arguments object and returns string result
4. Wrap implementation in try-catch to return error messages

Example tool:
```typescript
this.tools.set("my_tool", async (args: any) => {
  try {
    const { input } = args;
    // Implementation...
    return `Result: ${input}`;
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : String(error)}`;
  }
});
```

## Common Patterns & Conventions

### Error Handling
- All tool handlers wrap logic in try-catch
- Return error messages as strings (not exceptions)
- Follow format: `Error: <message>`
- HTTP endpoints return JSON with error field

### Fetch & External APIs
- Use `fetch()` for Yahoo Finance endpoints
- Always parse response as JSON or text appropriately
- Handle network errors gracefully

### Configuration
- SSE Transport initialization happens lazily on first request to avoid resource waste
- Tools are initialized in the `initializeTools()` method

## TypeScript Configuration
- Target `ES2022` for Node.js compatibility (required for Yahoo Finance API calls)
- NoUnusedLocals enforces clean code
- Durable Objects use WorkerEntrypoint pattern for statefulness
