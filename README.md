# mite

Tiny and fast HTTP GET module for crawling HTML and assets with auto-deflate.

## Installation

```sh
npm install mite
```

## Usage

```ts
import request, { agent } from "mite";

// Simple GET request - returns stream immediately
const stream = request("https://api.example.com");

// Process stream data as it arrives
stream.on("data", (chunk) => {
  console.log("Received chunk:", chunk.toString());
});

stream.on("end", () => {
  console.log("Stream complete");
});

stream.on("error", (err) => {
  console.error("Stream error:", err);
});
```

and with connection control:

```ts
import request, { agent } from "mite";

// Use agent for requests
const stream = request(
  "https://api.example.com",
  agent({
    // Connection pool parameters
    connections: 100, // Max connections per host
    keepAliveTimeout: 30000, // 30 seconds keep-alive
    keepAliveMaxTimeout: 600000, // 10 minutes max timeout
    keepAliveTimeoutThreshold: 2000, // Grace period for keep-alive

    // Pipelining configuration
    pipelining: 10, // HTTP/1.1 pipelining depth

    // Custom timeouts
    headersTimeout: 30000, // Headers timeout
    bodyTimeout: 300000, // Body timeout (5 minutes)

    // TLS configuration
    connect: {
      rejectUnauthorized: true,
      servername: "api.example.com",
    },
  })
);
```
