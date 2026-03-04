# Deployment & Setup Guide

## Prerequisites

- Node.js 22+
- Cloudflare account (free tier OK)
- `wrangler` CLI installed globally or locally

## Installation

```bash
# Install dependencies
npm install

# Verify TypeScript compiles
npm run type-check
```

## Local Development

```bash
# Start Wrangler dev server (runs on port 8787)
npm run dev

# In another terminal, test connectivity
curl http://localhost:8787/

# Test the SSE endpoint
curl http://localhost:8787/sse

# Test a tool call (example: AAPL stock price)
curl -X POST http://localhost:8787/messages \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "get_stock_price",
      "arguments": {
        "symbol": "AAPL"
      }
    }
  }'
```

## Deployment to Cloudflare Workers

### Step 1: Authenticate

```bash
npm run wrangler -- login
# Opens browser for authentication
```

### Step 2: Deploy

```bash
npm run deploy
```

### Step 3: Verify Deployment

After deployment completes, Wrangler will show your deployment URL. Test it:

```bash
curl https://yfinance-mcp.YOUR_SUBDOMAIN.workers.dev/
```

## Using the MCP Server

### REST API Endpoints

- `GET /` - Server status and tool listing
- `GET /sse` - SSE connection (for MCP clients)
- `POST /messages` - JSON-RPC message handler

### Available Tools

#### 1. `get_stock_price`

Fetch current stock quote data.

**Request:**
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

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Stock: AAPL\nCurrent Price: $150.25\n..."
      }
    ]
  }
}
```

#### 2. `get_historical_prices`

Fetch historical price data for a date range.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_historical_prices",
    "arguments": {
      "symbol": "AAPL",
      "start_date": "2024-01-01",
      "end_date": "2024-01-31"
    }
  }
}
```

## Troubleshooting

### Port 8787 Already in Use

```bash
# Find process on port 8787
lsof -i :8787

# Kill the process
kill -9 <PID>
```

### Deployment Fails

```bash
# Check account status
npm run wrangler -- whoami

# Verify wrangler.jsonc is valid
npm run wrangler -- deploy --dry-run
```

### API Calls Return Errors

- Verify symbol format (e.g., "AAPL" not "Apple")
- Check date formats (YYYY-MM-DD)
- Check network access to Yahoo Finance API

## Production Considerations

1. **Rate Limiting:** Implement caching or rate limits for production use
2. **Error Handling:** Consider more robust error recovery
3. **Monitoring:** Set up Cloudflare Analytics or use `wrangler tail`
4. **Environment Variables:** Use `wrangler secret` for sensitive data if needed

## Monitoring & Logs

```bash
# Real-time logs from deployed worker
npm run wrangler -- tail
```

## Additional Resources

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects Guide](https://developers.cloudflare.com/durable-objects/)
- [MCP Protocol Spec](https://modelcontextprotocol.io/)
- [Yahoo Finance API](https://finance.yahoo.com/)
