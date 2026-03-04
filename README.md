# yfinance-mcp

A **Model Context Protocol (MCP) Server** running on **Cloudflare Workers** that provides Yahoo Finance stock data. This server enables AI agents to fetch real-time stock prices and historical data through a stateful SSE (Server-Sent Events) connection.

## 🏗️ Architecture

Built using the **Cloudflare Agents pattern** with:
- **Durable Objects** (`WorkerEntrypoint`) for maintaining stateful SSE connections
- **MCP Server** (`@modelcontextprotocol/sdk`) for tool registration and JSON-RPC handling
- **Yahoo Finance 2** API wrapper for financial data
- **TypeScript + Zod** for type safety and validation

### Why Durable Objects?
The MCP protocol requires persistent, bidirectional communication. Durable Objects maintain in-memory state across multiple requests, ensuring a single MCP server instance per namespace (`idFromName("default")`).

## 🛠️ Quick Start

### Prerequisites
- Node.js 22+ (via devcontainer or local)
- Cloudflare account for deployment
- Wrangler CLI (`npm install -g wrangler`)

### Installation & Development

```bash
# Install dependencies
npm ci

# Start local dev server (port 8787)
npm run dev

# In another terminal, test the SSE endpoint
curl http://localhost:8787/sse
```

### Deployment

```bash
# Authenticate with Cloudflare
wrangler login

# Deploy to Cloudflare Workers
npm run deploy
```

## 🎯 Available Tools

### `get_stock_price`
Fetches current stock price and market data.

**Schema:**
```typescript
{
  symbol: string  // Stock symbol (e.g., "AAPL")
}
```

**Response:** Current price, change, market cap, 52-week high/low, etc.

### `get_historical_prices`
Fetches historical stock prices within a date range.

**Schema:**
```typescript
{
  symbol: string        // Stock symbol (e.g., "AAPL")
  start_date: string    // YYYY-MM-DD format
  end_date: string      // YYYY-MM-DD format
}
```

**Response:** CSV-formatted historical data (open, high, low, close, volume)

## 🔌 API Endpoints

### `GET /sse`
Establishes SSE connection for MCP protocol communication.

**Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### `POST /messages`
Accepts JSON-RPC messages and routes them to tool handlers.

**Body:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_stock_price",
    "arguments": {
      "symbol": "AAPL"
    }
  }
}
```

## 📁 Project Structure

```
src/index.ts              # YahooMcpServer Durable Object + tools
wrangler.jsonc            # Cloudflare Workers config
package.json              # Dependencies & scripts
tsconfig.json             # TypeScript configuration
.devcontainer/            # Dev container for VS Code
.github/copilot-*.md      # AI agent instructions
```

## 🚀 Adding New Tools

1. **Define a Zod schema** for inputs:
   ```typescript
   const MySchema = z.object({
     param: z.string().describe("Parameter description")
   });
   ```

2. **Register the tool** in `initializeMcpServer()`:
   ```typescript
   this.mcpServer.tool("my_tool", "Description", MySchema, async (request) => {
     const { param } = request.params.arguments;
     // Implementation...
     return {
       content: [{ type: "text", text: "Result" }],
       isError: false // optional, omit if no error
     };
   });
   ```

## ⚙️ Configuration

### `wrangler.jsonc`
- **Compatibility:** `nodejs_compat` flag for Node.js APIs
- **Durable Object:** `MCP_AGENT` binding to `YahooMcpServer`
- **Migration:** `v1` tag for schema versioning

### `tsconfig.json`
- **Target:** ES2022 (required for `yahoo-finance2` compatibility)
- **Module:** ESNext (ES modules)
- **Strict mode:** All strict checks enabled

## 🔒 Error Handling

All tool handlers **never throw**. Errors are caught and returned as:
```typescript
{
  content: [{ type: "text", text: "Error message" }],
  isError: true
}
```

## 📚 Key Dependencies

| Package | Purpose |
|---------|---------|
| `@modelcontextprotocol/sdk` | MCP server/transport |
| `yahoo-finance2` | Yahoo Finance data fetching |
| `zod` | Schema validation |
| `@cloudflare/workers-types` | Cloudflare Workers types |

## 🐛 Development Tips

- **Watch mode:** `npm run dev` auto-reloads on file changes
- **Type checking:** `npm run type-check` validates TypeScript
- **Local testing:** Use `curl` or Postman to test endpoints
- **Logs:** Wrangler dev shows request/response logs automatically

## 📖 Documentation

For more details, see:
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)

## 📄 License

MIT