require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: {
        version: "0.8.30",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200
            }
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
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
            chainId: 560048
        },
        polygon: {
            url: process.env.POLYGON_RPC || "https://polygon-rpc.com",
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
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
