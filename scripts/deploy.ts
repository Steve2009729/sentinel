import { ethers } from "hardhat";

async function main() {
  // signal fee = 0.0001 HSK (tiny)
  const fee = ethers.parseEther("0.0001");
  const Factory = await ethers.getContractFactory("SignalSettlement");
  const contract = await Factory.deploy(fee);
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  console.log("SignalSettlement deployed to:", address);
  console.log("Add this to .env as CONTRACT_ADDRESS and NEXT_PUBLIC_CONTRACT_ADDRESS");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
