import "@nomiclabs/hardhat-ethers";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-preprocessor";
import "hardhat-abi-exporter";
import {resolve} from "path";
import {config as dotenvConfig} from "dotenv";
import {HardhatUserConfig, task} from "hardhat/config";

dotenvConfig({path: resolve(__dirname, "./.env")});

if( ! process.env.PRIVATE_KEY  ){
    throw new Error("No private key in .env file");
}



import "./hardhat.tasks";

const config: HardhatUserConfig = {
    networks: {
        hardhat: {
            initialBaseFeePerGas: 0,
        },
        mainnet: {
            url: process.env.RPC_MAINNET,
            accounts: [process.env.PRIVATE_KEY!]
        },
        testnet: {
            url: process.env.RPC_TESTNET,
            accounts: [process.env.PRIVATE_KEY!]
        },

    },
    solidity: {
        version: "0.8.13",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    etherscan: {
        apiKey: {
            testnet: `${process.env.BSCSCAN}`,
            mainnet: `${process.env.BSCSCAN}`,
            bscTestnet: `${process.env.BSCSCAN}`
        }
    }
};


export default config;
