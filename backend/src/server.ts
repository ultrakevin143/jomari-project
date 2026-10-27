import { createDatabase } from "./database/client.js";

import { createApp } from "./app.js";
import { getConfig } from "./config/env.js";

const config = getConfig();
const db = createDatabase();
const app = createApp(db, config);
const server = app.listen(config.PORT, config.HOST, () =>
  console.info(`Waste Hub API: http://${config.HOST}:${config.PORT}`),
);
async function stop() {
  server.close(async () => {
    await db.$disconnect();
    process.exit(0);
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
