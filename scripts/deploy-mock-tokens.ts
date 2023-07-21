import getDeploymentConfig from "../deployment-config";
import fs from "fs";
import {ethers} from "ethers";
let chainId: number, mainNet: boolean, testNet: boolean;
let CONTRACTS: any = {};
let tx; // running tx variable to wait for execution
let deployer:hre.ethers.Wallet; // signer for tx
function get(name: string): string {
    if (CONTRACTS[name])
        return CONTRACTS[name];
    const cache = `contracts-${chainId}.json`;
    if (!fs.existsSync(cache))
        fs.writeFileSync(cache, "{}");
    const contracts = fs.readFileSync(cache, "utf8");
    // @ts-ignore
    const addr = contracts[name];
    if (!addr) {
        throw new Error(`Contract ${name} not found in ${cache}`);
    }
    CONTRACTS[name] = addr;
    return addr;
}

function set(name: string, addr: string): string {
    const cache = `contracts-${chainId}.json`;
    if (!fs.existsSync(cache))
        fs.writeFileSync(cache, "{}");
    const contracts = fs.readFileSync(cache, "utf8");
    const json = JSON.parse(contracts);
    json[name] = addr;
    CONTRACTS[name] = addr;
    fs.writeFileSync(cache, JSON.stringify(json, null, 4));
    console.log(`# ${name} deployed at ${addr}`);
    return addr;
}

async function verify(contract: any, args: any[] = []) {

    return console.log(` - Skipping verification for ${contract.address}`);

    // dump balance of deployer:
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    console.log(` - Balance of deployer: ${ethers.utils.formatEther(balance)}`);
    const addr = contract.address;
    const verifyArgs = {
        address: addr,
        constructorArguments: args,
    };
    try {
        if ( mainNet || testNet) {
            await contract.deployTransaction.wait(5);
            hre.run("verify:verify", verifyArgs);
        }
    } catch (e) {
        console.log(` - Verification failed for ${addr}`);
        console.log(` - verifyArgs:`, verifyArgs);
        console.log(e);
    }
}

async function main() {
    const network = await hre.ethers.provider.getNetwork();
    chainId = network.chainId;
    mainNet = chainId === 5610;
    testNet = chainId === 5611;
    const CONFIG = getDeploymentConfig(mainNet);
    // public key from private key:
    deployer = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
    console.log(`#Network: ${chainId}, deployer: ${deployer.address}`);
    const balance = await hre.ethers.provider.getBalance(deployer.address);
    if( balance.lt(ethers.utils.parseEther("0.1")) ) {
        throw new Error(`Deployer balance is too low: ${ethers.utils.formatEther(balance)}`);
    }
    console.log(` - Balance of deployer: ${ethers.utils.formatEther(balance)}`);
    console.log(` - RPC: ${mainNet ? process.env.RPC_MAINNET : process.env.RPC_TESTNET}`);
    // Load
    const [
        FaucetERC20d6,
        FaucetERC20d8,
        WETH
    ] = await Promise.all([
        hre.ethers.getContractFactory("FaucetERC20d6"),
        hre.ethers.getContractFactory("FaucetERC20d8"),
        hre.ethers.getContractFactory("WETH"),
    ]);

    const usdc = await FaucetERC20d6.deploy("USD Coin", "USDC", 100_000e6);
    await usdc.deployed();
    set("usdc", usdc.address);
    await verify(usdc);

    const usdt = await FaucetERC20d6.deploy("Tether USD", "USDT", 100_000e6);
    await usdt.deployed();
    set("usdt", usdt.address);
    await verify(usdt);

    const wbtc = await FaucetERC20d8.deploy("Wrapped BTC", "WBTC", 100e8);
    await wbtc.deployed();
    set("wbtc", wbtc.address);
    await verify(wbtc);

    const weth = await WETH.deploy();
    await weth.deployed();
    set("weth", weth.address);
    await verify(weth);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
