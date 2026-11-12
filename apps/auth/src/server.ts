import { createServer } from "node:http";
import { toNodeHandler } from "better-auth/node";
import { loadConfig } from "./config.js";
import { unavailableWithoutMail } from "./request-policy.js";
import { createAuth } from "./auth.js";
const config = loadConfig();
const auth = createAuth(config);
const handler = toNodeHandler(auth);
createServer((request, response) => {
  if (
    unavailableWithoutMail(
      request.url ?? "/",
      Boolean(config.mail.url && config.mail.from),
    )
  ) {
    response
      .writeHead(503, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Password reset is unavailable" }));
    return;
  }
  if (!request.url?.startsWith("/api/auth/")) {
    response.writeHead(404).end();
    return;
  }
  void Promise.resolve(handler(request, response)).catch(() => {
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
}).listen(3001, "127.0.0.1");
