require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || process.env.RPC_URL || "http://127.0.0.1:7545";
const DEFAULT_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.FINANCE_PRIVATE_KEY;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      },
      evmVersion: "paris"
    }
  },
  networks: {
    ganache: {
      url: RPC_URL,
      chainId: 1337,
      accounts: DEFAULT_KEY ? [DEFAULT_KEY] : []
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: true
    }
  }
};
