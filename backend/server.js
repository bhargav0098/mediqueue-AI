const { server } = require('./app');

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`\nMediQueueAI V7 running on port ${PORT}`);
  console.log(`📡 WebSocket | 🤖 AI Triage | 📋 Live Queue | 💊 Prescriptions`);
});

module.exports = server;
