require("@nomicfoundation/hardhat-toolbox");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

// Explicit validation to block accidental Ganache RPC or accounts in Sepolia config
const sepoliaRpc = process.env.SEPOLIA_RPC_URL || "";
if (sepoliaRpc.includes("127.0.0.1") || sepoliaRpc.includes("localhost") || sepoliaRpc.includes(":7545") || sepoliaRpc.includes(":8545")) {
  console.warn("WARNING: SEPOLIA_RPC_URL appears to point to a local loopback/Ganache node! Sepolia network requires a valid Sepolia testnet RPC endpoint.");
}

let rawDeployerKey = (process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY || "").trim();
if (rawDeployerKey && !rawDeployerKey.startsWith("0x") && rawDeployerKey.length === 64) {
  rawDeployerKey = "0x" + rawDeployerKey;
}
const deployerKey = rawDeployerKey ? [rawDeployerKey] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    sepolia: {
      url: sepoliaRpc,
      accounts: deployerKey,
      chainId: 11155111,
      timeout: 60000,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
