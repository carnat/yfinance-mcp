/// <reference types="@cloudflare/workers-types" />

/**
 * WorkerEntrypoint - Base class for Cloudflare Durable Objects
 * Declared here since it's provided by the Cloudflare runtime
 */
declare class WorkerEntrypoint {
  env: any;
  state: any;
  fetch(request: Request): Promise<Response>;
}

/**
 * YahooMcpServer - Durable Object that implements MCP Server
 * Uses SSE transport for stateful connections
 */
export class YahooMcpServer extends WorkerEntrypoint {
  private tools: Map<string, (args: any) => Promise<string>> = new Map();

  /**
   * Initialize MCP Server with available tools
   */
  private initializeTools() {
    // Register get_stock_price tool
    this.tools.set("get_stock_price", async (args: any) => {
      try {
        const { symbol } = args;

        // Fetch from Yahoo Finance API
        const response = await fetch(
          `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${symbol}?modules=price`
        );
        const data = (await response.json()) as any;

        if (!data.quoteSummary?.result) {
          return `No data found for symbol: ${symbol}`;
        }

        const result = data.quoteSummary.result[0];
        const price = result.price;
        const text = `
Stock: ${symbol}
Current Price: $${price.regularMarketPrice?.raw || "N/A"}
Currency: ${price.currency || "USD"}
Change: ${price.regularMarketChange?.raw || "N/A"} (${price.regularMarketChangePercent?.raw || "N/A"}%)
Market Cap: ${price.marketCap?.raw || "N/A"}
52 Week High: $${price.fiftyTwoWeekHigh?.raw || "N/A"}
52 Week Low: $${price.fiftyTwoWeekLow?.raw || "N/A"}
        `.trim();

        return text;
      } catch (error) {
        return `Error fetching stock price: ${error instanceof Error ? error.message : String(error)}`;
      }
    });

    // Register get_historical_prices tool
    this.tools.set("get_historical_prices", async (args: any) => {
      try {
        const { symbol, start_date, end_date } = args;

        const startTime = Math.floor(new Date(start_date).getTime() / 1000);
        const endTime = Math.floor(new Date(end_date).getTime() / 1000);

        const response = await fetch(
          `https://query1.finance.yahoo.com/v7/finance/download/${symbol}?period1=${startTime}&period2=${endTime}&interval=1d&events=history`
        );
        const csv = await response.text();

        if (!csv || csv.includes("Not found")) {
          return `No historical data found for symbol: ${symbol}`;
        }

        const lines = csv.split("\n").slice(0, 21); // Header + 20 records
        const text = `Historical prices for ${symbol} (${start_date} to ${end_date}):
${lines.join("\n")}`;

        return text;
      } catch (error) {
        return `Error fetching historical prices: ${error instanceof Error ? error.message : String(error)}`;
      }
    });
  }

  /**
   * Handle requests to the worker
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Initialize tools on first request
    if (this.tools.size === 0) {
      this.initializeTools();
    }

    // Route /sse for Server-Sent Events connection
    if (url.pathname === "/sse") {
      return this.handleSSE();
    }

    // Route /messages for JSON-RPC messages
    if (url.pathname === "/messages" && request.method === "POST") {
      return this.handleMessages(request);
    }

    return new Response(
      JSON.stringify({
        status: "MCP Server Ready",
        tools: Array.from(this.tools.keys()),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  /**
   * Handle /sse endpoint for establishing SSE connection
   */
  private handleSSE(): Response {
    try {
      // Create a stream for SSE
      const { readable, writable } = new TransformStream<Uint8Array>();
      const writer = writable.getWriter();

      // Send initial connection message
      (async () => {
        const message = `data: ${JSON.stringify({
          type: "connection",
          version: "1.0.0",
          tools: Array.from(this.tools.keys()),
        })}\n\n`;
        await writer.write(new TextEncoder().encode(message));
      })();

      return new Response(readable, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: `SSE Connection Error: ${error instanceof Error ? error.message : String(error)}`,
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  /**
   * Handle /messages endpoint for JSON-RPC messages
   */
  private async handleMessages(request: Request): Promise<Response> {
    try {
      const message = (await request.json()) as Record<string, any>;

      // Validate JSON-RPC format
      if (!message.id || !message.method) {
        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            error: { code: -32700, message: "Invalid JSON-RPC" },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Route tool calls
      if (message.method === "tools/call") {
        const toolName = message.params?.name;
        const toolArgs = message.params?.arguments || {};

        if (!this.tools.has(toolName)) {
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              id: message.id,
              error: { code: -32601, message: "Method not found" },
            }),
            { status: 400, headers: { "Content-Type": "application/json" } }
          );
        }

        const handler = this.tools.get(toolName)!;
        const result = await handler(toolArgs);

        return new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: message.id,
            result: {
              content: [{ type: "text", text: result }],
            },
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          jsonrpc: "2.0",
          id: message.id,
          error: { code: -32601, message: "Method not found" },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }
  }
}

/**
 * Default export: Standard fetch handler for routing to Durable Object
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const stub = env.MCP_AGENT.get(env.MCP_AGENT.idFromName("default"));
    return stub.fetch(request);
  },
} satisfies ExportedHandler<Env>;

interface Env {
  MCP_AGENT: DurableObjectNamespace;
}


