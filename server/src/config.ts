import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3005', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl:
    process.env.DATABASE_URL || 'postgres:///fortress?host=/var/run/postgresql',
  databaseTestUrl:
    process.env.DATABASE_TEST_URL || 'postgres:///fortress_test?host=/var/run/postgresql',
  stellar: {
    network: process.env.STELLAR_NETWORK || 'testnet',
    networkPassphrase:
      process.env.STELLAR_NETWORK_PASSPHRASE || 'Test SDF Network ; September 2015',
    rpcUrl:
      process.env.STELLAR_RPC_URL || 'https://soroban-testnet.stellar.org',
    horizonUrl:
      process.env.STELLAR_HORIZON_URL || 'https://horizon-testnet.stellar.org',
    contractId:
      process.env.FORTRESS_CONTRACT_ID ||
      'CC5J3P7BFORTRESS6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6R6SECURE',
    usdcContractId:
      process.env.STELLAR_USDC_CONTRACT_ID ||
      'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCUSDC',
    nativeAssetCode: 'XLM',
    stroopsPerXlm: 10_000_000,
  },
  corsOrigin: process.env.CORS_ORIGIN || '*',
};
