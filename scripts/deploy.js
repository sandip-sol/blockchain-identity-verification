const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
    console.log("🚀 Starting deployment...\n");

    // Get deployer account
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with account:", deployer.address);

    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log("Account balance:", hre.ethers.formatEther(balance), "ETH\n");

    // Deploy IdentityToken
    console.log("📝 Deploying IdentityToken...");
    const IdentityToken = await hre.ethers.getContractFactory("IdentityToken");
    const identityToken = await IdentityToken.deploy();
    await identityToken.waitForDeployment();
    const identityTokenAddress = await identityToken.getAddress();
    console.log("✅ IdentityToken deployed to:", identityTokenAddress);

    // Deploy TransactionRegistry
    console.log("\n📝 Deploying TransactionRegistry...");
    const TransactionRegistry = await hre.ethers.getContractFactory("TransactionRegistry");
    const transactionRegistry = await TransactionRegistry.deploy();
    await transactionRegistry.waitForDeployment();
    const transactionRegistryAddress = await transactionRegistry.getAddress();
    console.log("✅ TransactionRegistry deployed to:", transactionRegistryAddress);

    // Deploy DataAccessControl
    console.log("\n📝 Deploying DataAccessControl...");
    const DataAccessControl = await hre.ethers.getContractFactory("DataAccessControl");
    const dataAccessControl = await DataAccessControl.deploy();
    await dataAccessControl.waitForDeployment();
    const dataAccessControlAddress = await dataAccessControl.getAddress();
    console.log("✅ DataAccessControl deployed to:", dataAccessControlAddress);

    // Save deployment addresses
    const deploymentInfo = {
        network: hre.network.name,
        deployer: deployer.address,
        timestamp: new Date().toISOString(),
        contracts: {
            IdentityToken: identityTokenAddress,
            TransactionRegistry: transactionRegistryAddress,
            DataAccessControl: dataAccessControlAddress
        }
    };

    const deploymentsDir = path.join(__dirname, "../deployments");
    if (!fs.existsSync(deploymentsDir)) {
        fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const filename = `${hre.network.name}-${Date.now()}.json`;
    fs.writeFileSync(
        path.join(deploymentsDir, filename),
        JSON.stringify(deploymentInfo, null, 2)
    );

    // Also save as latest
    fs.writeFileSync(
        path.join(deploymentsDir, `${hre.network.name}-latest.json`),
        JSON.stringify(deploymentInfo, null, 2)
    );

    console.log("\n📄 Deployment info saved to:", filename);
    console.log("\n✨ Deployment completed successfully!\n");

    // Print summary
    console.log("=".repeat(60));
    console.log("CONTRACT ADDRESSES");
    console.log("=".repeat(60));
    console.log("IdentityToken:        ", identityTokenAddress);
    console.log("TransactionRegistry:  ", transactionRegistryAddress);
    console.log("DataAccessControl:    ", dataAccessControlAddress);
    console.log("=".repeat(60));

    if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
        console.log("\n⏳ Waiting for block confirmations...");
        await identityToken.deploymentTransaction().wait(5);

        console.log("\n📝 Verifying contracts on block explorer...");
        console.log("Run these commands to verify:\n");
        console.log(`npx hardhat verify --network ${hre.network.name} ${identityTokenAddress}`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${transactionRegistryAddress}`);
        console.log(`npx hardhat verify --network ${hre.network.name} ${dataAccessControlAddress}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
