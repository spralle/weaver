import type { AddressInfo, Socket } from "node:net";
import express, { type Request, type Response } from "express";

type RequestHandler = (request: Request, response: Response) => Promise<void>;

export interface HttpServer {
  readonly port: number;
  stop(): Promise<void>;
}

export async function startHttpServer(options: {
  port: number;
  handleRequest: RequestHandler;
}): Promise<HttpServer> {
  const app = express();
  app.set("trust proxy", true);

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: false }));
  app.use(async (req, res) => {
    try {
      await options.handleRequest(req, res);
    } catch {
      res.status(500).json({ error: "internal server error" });
    }
  });

  const server = await new Promise<ReturnType<typeof app.listen>>(
    (resolve, reject) => {
      const httpServer = app.listen(options.port, () => {
        httpServer.off("error", reject);
        resolve(httpServer);
      });
      httpServer.once("error", reject);
    },
  );

  const address = server.address() as AddressInfo | null;
  const sockets = new Set<Socket>();
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });

  return {
    port: address?.port ?? options.port,
    async stop() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });

        server.closeAllConnections?.();
        for (const socket of sockets) {
          socket.destroy();
        }
      });
    },
  };
}
