const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Known default Ganache private keys that must be strictly rejected
const FORBIDDEN_GANACHE_KEYS = [
  "0x5c1773faf03c71052871f2ce322dc5b61bedc26b92f9a1943d408b81edb378ba",
  "0x8227b5bce285ad9e8a2d06c6dba71cf7734ddc3e273f491a33a62283b9b18473",
  "0xd370fdcbda2d39b300ff21d1d60695c8c24aeb3fa068e5c894684f4704a15c79",
  "0xfd55cc94a1342b59e57dcccb78832e52ac1da472a1f39f08d1673c79146e542b",
  "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d",
  "0x6cbed15c793ce57650b9877cf26f5d7d95775ee618825f4dd473c15535d12a93"
];

const EXPECTED_SEPOLIA_CHAIN_ID = 11155111n;

async function main() {
  console.log("============================================================");
  console.log(" Ethereum Sepolia Deployment Script (GOV_BLOCKS)");
  console.log("============================================================");

  // 1. Validate Environment Variables
  const rpcUrl = (process.env.SEPOLIA_RPC_URL || "").trim();
  let deployerKey = (process.env.SEPOLIA_DEPLOYER_PRIVATE_KEY || "").trim();
  if (deployerKey && !deployerKey.startsWith("0x") && deployerKey.length === 64) {
    deployerKey = "0x" + deployerKey;
  }

  if (!rpcUrl) {
    throw new Error(
      "[CONFIG ERROR] Missing SEPOLIA_RPC_URL environment variable. " +
      "Please configure your Infura/Alchemy/QuickNode Sepolia RPC endpoint in blockchain/.env"
    );
  }

  if (rpcUrl.includes("127.0.0.1") || rpcUrl.includes("localhost") || rpcUrl.includes("7545") || rpcUrl.includes("8545")) {
    throw new Error(
      "[SECURITY VIOLATION] SEPOLIA_RPC_URL points to a local Ganache/loopback address! " +
      "Sepolia deployment strictly forbids local Ganache endpoints."
    );
  }

  if (!deployerKey) {
    throw new Error(
      "[CONFIG ERROR] Missing SEPOLIA_DEPLOYER_PRIVATE_KEY environment variable. " +
      "Please configure a dedicated test-only deployer private key in blockchain/.env"
    );
  }

  if (FORBIDDEN_GANACHE_KEYS.some((k) => k.toLowerCase() === deployerKey.toLowerCase())) {
    throw new Error(
      "[SECURITY VIOLATION] SEPOLIA_DEPLOYER_PRIVATE_KEY is a default Ganache private key! " +
      "Default Ganache keys are strictly prohibited for public testnet deployment."
    );
  }

  if (!deployerKey.startsWith("0x") || deployerKey.length !== 66) {
    throw new Error(
      "[FORMAT ERROR] SEPOLIA_DEPLOYER_PRIVATE_KEY must be a 66-character hex string (or 64-character raw hex) starting with 0x."
    );
  }

  // 2. Validate Connected Network & Chain ID
  const network = await hre.ethers.provider.getNetwork();
  const currentChainId = network.chainId;
  console.log(`Connected Network Name: ${network.name}`);
  console.log(`Connected Chain ID    : ${currentChainId.toString()}`);

  if (currentChainId !== EXPECTED_SEPOLIA_CHAIN_ID) {
    throw new Error(
      `[CHAIN ID MISMATCH] Expected Sepolia Chain ID ${EXPECTED_SEPOLIA_CHAIN_ID.toString()}, ` +
      `but connected provider returned ${currentChainId.toString()}. Deployment aborted for security.`
    );
  }

  // 3. Inspect Deployer Account and Balance
  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await hre.ethers.provider.getBalance(deployerAddress);
  const balanceEth = hre.ethers.formatEther(balance);

  console.log(`Deployer Address      : ${deployerAddress}`);
  console.log(`Deployer ETH Balance  : ${balanceEth} SepoliaETH`);

  if (balance === 0n) {
    throw new Error(
      `[INSUFFICIENT FUNDS] Deployer account ${deployerAddress} has 0 SepoliaETH. ` +
      "Please request test ETH from a Sepolia faucet (e.g. Alchemy Faucet, Google Cloud Web3 Faucet) before deploying."
    );
  }

  const minRecommended = hre.ethers.parseEther("0.005");
  if (balance < minRecommended) {
    console.warn(
      `[LOW BALANCE WARNING] Deployer balance (${balanceEth} SepoliaETH) is below the recommended 0.005 SepoliaETH. ` +
      "Deployment gas may be tight depending on current network base fees."
    );
  }

  // 4. Verify Contract Compilation
  const artifactPath = path.join(__dirname, "../artifacts/contracts/GovernmentFundTracking.sol/GovernmentFundTracking.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error("[BUILD ERROR] Compiled contract artifact not found. Please run 'npx hardhat compile' before deploying.");
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;

  // 5. Deploy GovernmentFundTracking Contract
  console.log("\nDeploying GovernmentFundTracking contract to Sepolia testnet...");
  const ContractFactory = await hre.ethers.getContractFactory("GovernmentFundTracking");
  const contract = await ContractFactory.deploy();

  const deployTx = contract.deploymentTransaction();
  if (!deployTx) {
    throw new Error("[DEPLOYMENT ERROR] No deployment transaction returned by provider.");
  }
  const txHash = deployTx.hash;
  console.log(`Transaction broadcast: ${txHash}`);
  console.log("Waiting for block confirmation and deployment receipt on Sepolia...");

  await contract.waitForDeployment();
  const receipt = await deployTx.wait(1);

  if (!receipt || receipt.status !== 1) {
    throw new Error(`[DEPLOYMENT REVERTED] Transaction ${txHash} failed or reverted on Sepolia.`);
  }

  const contractAddress = await contract.getAddress();

  console.log("\n============================================================");
  console.log(" CONTRACT DEPLOYMENT SUCCESSFUL");
  console.log("============================================================");
  console.log(`Contract Address      : ${contractAddress}`);
  console.log(`Transaction Hash      : ${txHash}`);
  console.log(`Block Number          : #${receipt.blockNumber}`);
  console.log(`Gas Used              : ${receipt.gasUsed.toString()}`);
  console.log(`Deployer Address      : ${deployerAddress}`);
  console.log(`Network               : sepolia (Chain ID 11155111)`);
  console.log("============================================================\n");

  // 6. Initialize Default Administrative Roles on-chain
  function resolveRoleAddress(envVarName, fallbackAddress, roleLabel) {
    const raw = (process.env[envVarName] || "").trim();
    if (raw) {
      if (!hre.ethers.isAddress(raw)) {
        throw new Error(`[CONFIG ERROR] Invalid Ethereum address in ${envVarName}: "${raw}"`);
      }
      return hre.ethers.getAddress(raw);
    }
    console.log(`  * ${roleLabel}: No dedicated address in ${envVarName}; assigning to deployer (${fallbackAddress})`);
    return fallbackAddress;
  }

  console.log("Resolving departmental role addresses for on-chain initialization...");
  const financeAddress = resolveRoleAddress("SEPOLIA_FINANCE_ADDRESS", deployerAddress, "Finance Department");
  const stateAddress = resolveRoleAddress("SEPOLIA_STATE_ADDRESS", deployerAddress, "State Treasury");
  const districtAddress = resolveRoleAddress("SEPOLIA_DISTRICT_ADDRESS", deployerAddress, "District Officer");
  const contractorAddress = resolveRoleAddress("SEPOLIA_CONTRACTOR_ADDRESS", deployerAddress, "Contractor");
  const auditorAddress = resolveRoleAddress("SEPOLIA_AUDITOR_ADDRESS", deployerAddress, "Auditor");

  console.log("\nExecuting initializeDefaultRoles transaction on Sepolia...");
  const initTx = await contract.initializeDefaultRoles(
    financeAddress,
    stateAddress,
    districtAddress,
    contractorAddress,
    auditorAddress
  );
  console.log(`Role initialization tx broadcast: ${initTx.hash}`);
  console.log("Waiting for role initialization receipt (1 confirmation)...");
  const initReceipt = await initTx.wait(1);

  if (!initReceipt || initReceipt.status !== 1) {
    throw new Error(`[ROLE INITIALIZATION FAILED] Transaction ${initTx.hash} reverted on Sepolia.`);
  }

  console.log("\n============================================================");
  console.log(" ROLE INITIALIZATION SUCCESSFUL");
  console.log("============================================================");
  console.log(`Role Init Tx Hash     : ${initTx.hash}`);
  console.log(`Role Init Block       : #${initReceipt.blockNumber}`);
  console.log(`Role Init Gas Used    : ${initReceipt.gasUsed.toString()}`);
  console.log(`- Super Admin         : ${deployerAddress}`);
  console.log(`- Finance Role        : ${financeAddress}`);
  console.log(`- State Role          : ${stateAddress}`);
  console.log(`- District Role       : ${districtAddress}`);
  console.log(`- Contractor Role     : ${contractorAddress}`);
  console.log(`- Auditor Role        : ${auditorAddress}`);
  console.log("============================================================\n");

  // 7. Update backend hosted configuration template with genuine deployed metadata
  const contractInfo = {
    contractAddress: contractAddress,
    network: "sepolia",
    chainId: 11155111,
    deployer: deployerAddress,
    deploymentTransaction: txHash,
    deploymentBlockNumber: receipt.blockNumber,
    deploymentGasUsed: receipt.gasUsed.toString(),
    roleInitializationTransaction: initTx.hash,
    roleInitializationBlockNumber: initReceipt.blockNumber,
    roleInitializationGasUsed: initReceipt.gasUsed.toString(),
    roles: {
      superAdmin: deployerAddress,
      finance: financeAddress,
      state: stateAddress,
      district: districtAddress,
      contractor: contractorAddress,
      auditor: auditorAddress
    },
    deployedAt: new Date().toISOString(),
    abi: abi
  };

  const hostedConfigPath = path.join(__dirname, "../../backend/config/contract_info.hosted.json");
  fs.writeFileSync(hostedConfigPath, JSON.stringify(contractInfo, null, 2));
  console.log(`[CONFIG UPDATED] Written deployment details to: ${hostedConfigPath}`);
}

main().catch((error) => {
  console.error("\nDeployment failed with error:\n", error);
  process.exitCode = 1;
});
