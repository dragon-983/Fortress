import { app } from './app.js';
import { config } from './config.js';

app.listen(config.port, () => {
  console.log(`🏰 FORTRESS Server running on port ${config.port} [${config.nodeEnv}]`);
  console.log(`🌐 Stellar Network: ${config.stellar.network} (${config.stellar.rpcUrl})`);
  console.log(`📜 Smart Account Contract: ${config.stellar.contractId}`);
});
