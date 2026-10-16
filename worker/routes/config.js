import { Hono } from 'hono';

const config = new Hono();

// Public, non-secret client configuration.
config.get('/', (c) =>
  c.json({
    googleClientId: c.env.GOOGLE_CLIENT_ID || null,
    appName: c.env.APP_NAME || 'Hyderabad Tycoon',
  }),
);

export default config;
