require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Only use PRIVATE_KEY if it looks like a valid 32-byte hex string
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const accounts = PRIVATE_KEY && /^[0-9a-fA-F]{64}$/.test(PRIVATE_KEY) ? [PRIVATE_KEY] : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.30",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            },
            evmVersion: "cancun",
        }
    },
    networks: {
        hardhat: {
            chainId: 1337
        },
        localhost: {
            url: "http://127.0.0.1:8545"
        },
        hoodi: {
            url: process.env.HOODI_DEPLOY_RPC || "https://hoodi.infura.io/v3/",
            accounts: accounts,
            chainId: 560048
        },
        polygon: {
            url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
            accounts: accounts,
            chainId: 137
        }
    },
    etherscan: {
        apiKey: {
            hoodi: process.env.HOODI_API_KEY || "",
            polygon: process.env.POLYGONSCAN_API_KEY || ""
        }
    },
    paths: {
        sources: "./contracts",
        tests: "./contracts/test",
        cache: "./cache",
        artifacts: "./artifacts"
    }
};
