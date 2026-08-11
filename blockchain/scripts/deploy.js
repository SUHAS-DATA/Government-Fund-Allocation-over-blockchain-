const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  console.log("Compiling & Deploying GovernmentFundTracking contract...");

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const GovernmentFundTracking = await hre.ethers.getContractFactory("GovernmentFundTracking");
  const contract = await GovernmentFundTracking.deploy();
  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();
  console.log(">>> GovernmentFundTracking deployed successfully to:", contractAddress);

  // Extract artifact and ABI
  const artifact = await hre.artifacts.readArtifact("GovernmentFundTracking");

  const contractInfo = {
    contractAddress: contractAddress,
    network: hre.network.name || "ganache",
    chainId: hre.network.config.chainId || 5777,
    deployer: deployer.address,
    abi: artifact.abi,
    deployedAt: new Date().toISOString()
  };

  // Export to backend config
  const backendConfigDir = path.join(__dirname, "../../backend/config");
  if (!fs.existsSync(backendConfigDir)) {
    fs.mkdirSync(backendConfigDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(backendConfigDir, "contract_info.json"),
    JSON.stringify(contractInfo, null, 2)
  );
  console.log("Exported contract info to backend/config/contract_info.json");

  // Export to frontend config
  const frontendConfigDir = path.join(__dirname, "../../frontend/src/config");
  if (!fs.existsSync(frontendConfigDir)) {
    fs.mkdirSync(frontendConfigDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(frontendConfigDir, "contract_info.json"),
    JSON.stringify(contractInfo, null, 2)
  );
  console.log("Exported contract info to frontend/src/config/contract_info.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
