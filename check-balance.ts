import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://mainnet.hsk.xyz");
const wallet = "0x1BFAe4EE12c8f2bF17B8EEb8Ea0BcB32AdbB240B";

provider.getBalance(wallet).then((b) => {
  console.log("Wallet balance:", ethers.formatEther(b), "HSK");
  console.log("Balance in wei:", b.toString());
});
