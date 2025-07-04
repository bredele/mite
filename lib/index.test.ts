import test from "node:test";
import assert from "node:assert";
import { createServer } from "node:http";
import { gzip } from "node:zlib";
import { promisify } from "node:util";
import request, { agent } from ".";

const gzipAsync = promisify(gzip);

// Utility function to convert stream to string
const streamToString = async (
  stream: NodeJS.ReadableStream
): Promise<string> => {
  const chunks: Buffer[] = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
};

// Test server setup
let testServer: any;
let testPort: number;

const sampleHTML = `<!DOCTYPE html>
<html>
<head>
  <title>Test Page</title>
</head>
<body>
  <h1>Hello World</h1>
  <p>This is a test HTML page for mite testing.</p>
  <div id="content">
    <ul>
      <li>Item 1</li>
      <li>Item 2</li>
      <li>Item 3</li>
    </ul>
  </div>
</body>
</html>`;

const largeHTML = `<!DOCTYPE html>
<html>
<head>
  <title>Large Test Page</title>
</head>
<body>
  <h1>Large Content Test</h1>
  ${Array.from(
    { length: 100 },
    (_, i) =>
      `<p>This is paragraph ${
        i + 1
      } with some content to make the response larger.</p>`
  ).join("")}
</body>
</html>`;

const startTestServer = async (): Promise<number> => {
  return new Promise((resolve) => {
    testServer = createServer(async (req, res) => {
      const url = req.url || "";

      if (url === "/html") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(sampleHTML);
      } else if (url === "/large") {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(largeHTML);
      } else if (url === "/compressed") {
        const compressed = await gzipAsync(sampleHTML);
        res.writeHead(200, {
          "Content-Type": "text/html",
          "Content-Encoding": "gzip",
        });
        res.end(compressed);
      } else if (url === "/json") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Hello from test server" }));
      } else {
        res.writeHead(404);
        res.end("Not Found");
      }
    });

    testServer.listen(0, () => {
      testPort = testServer.address().port;
      resolve(testPort);
    });
  });
};

const stopTestServer = async (): Promise<void> => {
  return new Promise((resolve) => {
    if (testServer) {
      testServer.close(() => resolve());
    } else {
      resolve();
    }
  });
};

// Comprehensive tests with local server
test("returns decompressed HTML content", async () => {
  await startTestServer();
  try {
    const stream = request(`http://localhost:${testPort}/html`);
    const content = await streamToString(stream);

    assert.ok(content.includes("<html>"));
    assert.ok(content.includes("Hello World"));
    assert.ok(content.includes("Test Page"));
    assert.ok(content.includes("<li>Item 1</li>"));
    assert.strictEqual(content, sampleHTML);
  } finally {
    await stopTestServer();
  }
});

test("handles gzip compressed responses", async () => {
  await startTestServer();
  try {
    const stream = request(`http://localhost:${testPort}/compressed`);
    const content = await streamToString(stream);

    assert.ok(content.includes("<html>"));
    assert.ok(content.includes("Hello World"));
    assert.ok(content.includes("Test Page"));
    assert.strictEqual(content, sampleHTML);
  } finally {
    await stopTestServer();
  }
});

test("handles large HTML responses", async () => {
  await startTestServer();
  try {
    const stream = request(`http://localhost:${testPort}/large`);
    const content = await streamToString(stream);

    assert.ok(content.includes("<html>"));
    assert.ok(content.includes("Large Content Test"));
    assert.ok(content.includes("paragraph 50"));
    assert.ok(content.includes("paragraph 100"));
    assert.ok(content.length > 5000); // Large response validation
  } finally {
    await stopTestServer();
  }
});

test("handles JSON responses", async () => {
  await startTestServer();
  try {
    const stream = request(`http://localhost:${testPort}/json`);
    const content = await streamToString(stream);

    const parsed = JSON.parse(content);
    assert.strictEqual(parsed.message, "Hello from test server");
  } finally {
    await stopTestServer();
  }
});

test("agent works with actual data transfer", async () => {
  await startTestServer();
  try {
    const testAgent = agent({ connections: 5, keepAliveTimeout: 1000 });
    const stream = request(`http://localhost:${testPort}/html`, testAgent);
    const content = await streamToString(stream);

    assert.ok(content.includes("<html>"));
    assert.ok(content.includes("Hello World"));
    assert.strictEqual(content, sampleHTML);
  } finally {
    await stopTestServer();
  }
});

test("agent handles compressed responses", async () => {
  await startTestServer();
  try {
    const testAgent = agent({ connections: 2, pipelining: 1 });
    const stream = request(
      `http://localhost:${testPort}/compressed`,
      testAgent
    );
    const content = await streamToString(stream);

    assert.ok(content.includes("<html>"));
    assert.strictEqual(content, sampleHTML);
  } finally {
    await stopTestServer();
  }
});

test("handles 404 responses gracefully", async () => {
  await startTestServer();
  try {
    const stream = request(`http://localhost:${testPort}/nonexistent`);
    const content = await streamToString(stream);

    assert.strictEqual(content, "Not Found");
  } finally {
    await stopTestServer();
  }
});

test("multiple concurrent requests work", async () => {
  await startTestServer();
  try {
    const promises = Array.from({ length: 5 }, async (_, i) => {
      const stream = request(`http://localhost:${testPort}/html`);
      const content = await streamToString(stream);
      return content;
    });

    const results = await Promise.all(promises);

    for (const content of results) {
      assert.ok(content.includes("<html>"));
      assert.strictEqual(content, sampleHTML);
    }
  } finally {
    await stopTestServer();
  }
});

// Legacy tests (keeping for compatibility)
test("request function returns a readable stream", async () => {
  const stream = request("https://httpbin.org/json");
  assert.ok(stream);
  assert.ok(typeof stream.pipe === "function");
});

test("agent function returns undici Agent", () => {
  const testAgent = agent({ connections: 50 });
  assert.ok(testAgent);
  assert.ok(typeof testAgent.dispatch === "function");
});

test("request with agent works", async () => {
  const testAgent = agent({ connections: 10 });
  const stream = request("https://httpbin.org/json", testAgent);
  assert.ok(stream);
  assert.ok(typeof stream.pipe === "function");
});

// Performance comparison test
test("performance: time to first data chunk", async () => {
  await startTestServer();
  try {
    const start = performance.now();
    const stream = request(`http://localhost:${testPort}/large`);
    const streamCreated = performance.now();

    let firstChunkTime: number;
    let firstChunk = true;

    await new Promise<void>((resolve) => {
      stream.on("data", (chunk) => {
        if (firstChunk) {
          firstChunkTime = performance.now();
          firstChunk = false;
        }
      });
      stream.on("end", resolve);
    });

    console.log("Stream creation time:", streamCreated - start, "ms");
    console.log("Time to first chunk:", firstChunkTime! - start, "ms");

    // Just verify we got data
    assert.ok(firstChunkTime! > start);
  } finally {
    await stopTestServer();
  }
});
