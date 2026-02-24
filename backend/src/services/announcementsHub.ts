import type { Response } from "express";

const clients = new Set<Response>();

export function addAnnouncementClient(res: Response) {
  clients.add(res);
  res.on("close", () => {
    clients.delete(res);
  });
}

export function broadcastAnnouncementsUpdate(payload: Record<string, unknown> = { type: "changed" }) {
  const data = `event: announcements:update\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(data);
    } catch {
      clients.delete(client);
    }
  }
}
