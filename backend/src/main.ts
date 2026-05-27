import { createApp } from './app.js';

const port = Number(process.env.PORT || 4101);
const app = createApp();

app.listen(port, () => {
  console.log('UPI FlowPilot API listening on http://127.0.0.1:' + port);
});

