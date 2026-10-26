import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';

process.env.TZ = 'UTC';

const nodeEnv = process.env.NODE_ENV || 'development';

for (const path of [`.env.${nodeEnv}`, `../.env.${nodeEnv}`]) {
  if (existsSync(path)) {
    loadDotenv({ path, override: false });
  }
}
