const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying ArcMail to Arc Testnet...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const ArcMail = await ethers.getContractFactory("ArcMail");
  const arcMail = await ArcMail.deploy();

  await arcMail.waitForDeployment();

  const address = await arcMail.getAddress();
  console.log("✅ ArcMail deployed to:", address);
  console.log("Explorer:", `https://testnet.arcscan.app/address/${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});