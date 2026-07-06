import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";
dotenv.config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const accounts = PRIVATE_KEY && PRIVATE_KEY !== "PASTE_YOUR_PRIVATE_KEY_HERE" ? [PRIVATE_KEY] : [];

const config: HardhatUserConfig = {
  solidity: "0.8.20",
  networks: {
    hskTestnet: {
      url: process.env.HSK_TESTNET_RPC || "https://testnet.hsk.xyz",
      chainId: 133,
      accounts,
    },
    hskMainnet: {
      url: process.env.HSK_MAINNET_RPC || "https://mainnet.hsk.xyz",
      chainId: 177,
      accounts,
    },
  },
};

export default config;
