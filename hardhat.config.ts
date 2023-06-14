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
            url: `https://rpc.mantle.xyz`,
            accounts: [process.env.PRIVATE_KEY!]
        },
        testnet: {
            url: `https://rpc.testnet.mantle.xyz`,
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
            testnet: 'x',
            mainnet: 'x',
            bscTestnet: `${process.env.BSCSCAN}`
        },
        customChains: [
            {
                network: "mainnet",
                chainId: 5000,
                urls: {
                    apiURL: "https://explorer.mantle.xyz/api",
                    browserURL: "https://explorer.mantle.xyz"
                }
            },
            { // npx hardhat verify --list-networks
                network: "testnet",
                chainId: 5001,
                urls: {
                    apiURL: "https://explorer.testnet.mantle.xyz/api",
                    browserURL: "https://explorer.testnet.mantle.xyz"
                }
            }
        ]
    }
};


export default config;
