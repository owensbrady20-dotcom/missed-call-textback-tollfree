const env = require('./config/env');
const app = require('./app');

app.listen(env.port, () => {
  console.log(`Listening on port ${env.port} (public base url: ${env.publicBaseUrl})`);
});
