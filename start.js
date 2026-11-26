// Pulls the data from Neon first, then starts the real server (server.js).
const storage = require('./storage');
storage.boot().then(() => {
  global.__zupaStorage = storage;
  global.__zupaReady = true;
  delete require.cache[require.resolve('./server.js')];
  require('./server.js');
}).catch((e) => {
  console.error('\n[ZUPA] Could not connect to the Neon database:', e.message);
  console.error('Check DATABASE_URL in your .env file (it must be the full connection string from Neon).\n');
  process.exit(1);
});
