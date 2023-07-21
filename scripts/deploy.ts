import getDeploymentConfig from "../deployment-config";
import fs from "fs";
import {ethers} from "ethers";
let chainId: number, mainNet: boolean, testNet: boolean, isHardhat: boolean;
let CONTRACTS: any = {};
let CONFIG = {};
let deployer:hre.ethers.Wallet; // signer for tx

let nonceOffset = 0;
async function getNonce():Promise<number>{
    return await hre.ethers.provider.getTransactionCount(deployer.address, "latest");
}
function fromWei(wei:bigint):string{
    return ethers.utils.formatEther(wei);
}

async function tx(contract:ethers.Contract, method:string, args:any[] = []){
    const buildInfo = contract.buildInfo;
    if( ! buildInfo ) console.log('contract.buildInfo not found');
    const name = `${buildInfo.contractName}.${method}`;
    let hash = get(name);
    if(hash) {
        console.log(` - tx: ${name} = ${hash} (skipped)`);
        return;
    }
    try{
        const fctlEstimate = contract.estimateGas[method];
        if( ! fctlEstimate ) throw new Error(` - method ${method} not found`);
        const estimatedGasLimit = await fctlEstimate(...args);
        const txUnsigned = await contract.populateTransaction[method](...args);
        txUnsigned.chainId = chainId;
        txUnsigned.gasLimit = estimatedGasLimit.mul(110).div(100);
        const gasPrice = await hre.ethers.provider.getGasPrice();
        txUnsigned.gasPrice = gasPrice.mul(110).div(100);
        txUnsigned.nonce = await getNonce();
        const txCostInWei = txUnsigned.gasLimit.mul(txUnsigned.gasPrice);
        const balance = await hre.ethers.provider.getBalance(deployer.address);
        if( balance.lt(txCostInWei) ) throw new Error(` - Insufficient balance: ${ethers.utils.formatEther(balance)} < ${ethers.utils.formatEther(txCostInWei)}`);
        console.log(` - tx: ${name} (COST=${fromWei(txCostInWei)}, gas=${txUnsigned.gasLimit}, gasPrice=${fromWei(txUnsigned.gasPrice)})`);
        const txSigned = await deployer.signTransaction(txUnsigned);
        const submittedTx = await hre.ethers.provider.sendTransaction(txSigned);
        const receipt = await submittedTx.wait();
        if (receipt.status === 0) throw new Error(" - Approve transaction failed");
        let hash = submittedTx.hash;
        const alias = hash.substring(0, 6);
        const line = ` - ${name}: [\`${alias}\`](${CONFIG.EXPLORER}tx/${hash})\n`;
        README += line;
        set(name, hash);
        console.log(`       ${hash}`);
    }catch(e) {
        const err = e.toString();
        const line = ` - ${name}: \`error\`\n`;
        nonceOffset--;
        README += line;
        console.log(`${name}: ${err}`);
        console.log(e);
    }
}

let README = "";
async function deployOrLoad(name: string, factory: any, args: any[] = []): Promise<ethers.Contract> {
    let addr = get(name);
    if (!addr) {
        new Error(`Address of ${name} not found`);
        const contract = await factory.deploy(...args);
        await contract.deployed();
        addr = contract.address;
        set(name, addr);
        await verify(contract, args);
    }
    console.log(`# ${name} at ${addr}`);
    const buildInfo = JSON.parse( fs.readFileSync(`artifacts/contracts/${name}.sol/${name}.json`, "utf8") );
    const abi = buildInfo.abi;
    const abiFile = `abi/${name}.json`;
    fs.writeFileSync(abiFile, JSON.stringify(abi, null, 4));
    const sourceName = buildInfo.sourceName;
    const contractName = buildInfo.contractName;
    await flatten(contractName, [sourceName]);
    README += `- [${sourceName}](${sourceName}) [\`${addr}\`](${CONFIG.EXPLORER}address/${addr}) ([abi](${abiFile}))\n`;
    const argumentsFile = `arguments/${name}.txt`;
    // encode arguments in abi format:
    const encoded = constructorArgs(abi, args);
    fs.writeFileSync(argumentsFile, encoded.replace(/0x/, ""));
    let ctx = await hre.ethers.getContractAt(name, addr, deployer);
    ctx.buildInfo =buildInfo;
    return ctx;
}

function constructorArgs(abi: any, args: any[] = []): string {
    let types = [];
    for (const entry of abi) {
        if (entry.type !== "constructor")
            continue;
        for (const input of entry.inputs) {
            types.push(input.type);
        }
    }
    return types.length ? ethers.utils.defaultAbiCoder.encode(types, args) : "";
}

async function main() {
    const network = await hre.ethers.provider.getNetwork();
    chainId = network.chainId;
    mainNet = chainId === 5610;
    testNet = chainId === 5611;
    isHardhat = chainId === 31337;

    let privateKey = process.env.PRIVATE_KEY;
    if( isHardhat ) {
        // PRIVATE_KEY_HARHDAT
        privateKey = process.env.PRIVATE_KEY_HARHDAT
    }
    CONFIG = getDeploymentConfig(mainNet);
    // public key from private key:
    deployer = new hre.ethers.Wallet(privateKey);
    console.log(`#Network: ${chainId}, deployer: ${deployer.address}`);

    README = `# Network: ${hre.network.name} #${chainId}\n\n`;
    README += `- Deployer: ${deployer.address}\n\n`;
    README += `#Compiler:\n\n`;
    README += `Version: ${hre.userConfig.solidity.version}\n\n`;
    README += `\`${JSON.stringify(hre.userConfig.solidity.settings.optimizer,undefined,2)}\`\n\n`;
    README += `# Contracts:\n\n`;

    // Load
    const [
        Token,
        GaugeFactory,
        BribeFactory,
        PairFactory,
        Router,
        Router2,
        Library,
        VeArtProxy,
        VotingEscrow,
        RewardsDistributor,
        Voter,
        Minter,
        TokenGovernor,
        MerkleClaim,
        WrappedExternalBribeFactory
    ] = await Promise.all([
        hre.ethers.getContractFactory("Token"),
        hre.ethers.getContractFactory("GaugeFactory"),
        hre.ethers.getContractFactory("BribeFactory"),
        hre.ethers.getContractFactory("PairFactory"),
        hre.ethers.getContractFactory("Router"),
        hre.ethers.getContractFactory("Router2"),
        hre.ethers.getContractFactory("TokenLibrary"),
        hre.ethers.getContractFactory("VeArtProxy"),
        hre.ethers.getContractFactory("VotingEscrow"),
        hre.ethers.getContractFactory("RewardsDistributor"),
        hre.ethers.getContractFactory("Voter"),
        hre.ethers.getContractFactory("Minter"),
        hre.ethers.getContractFactory("TokenGovernor"),
        hre.ethers.getContractFactory("MerkleClaim"),
        hre.ethers.getContractFactory("WrappedExternalBribeFactory"),
    ]);
    const token:ethers.Contract = await deployOrLoad("Token", Token);

    const pairFactory:ethers.Contract = await deployOrLoad("PairFactory", PairFactory);
    const router:ethers.Contract = await deployOrLoad("Router", Router, [pairFactory.address, CONFIG.WETH]);
    const router2:ethers.Contract = await deployOrLoad("Router2", Router2, [pairFactory.address, CONFIG.WETH]);
    const gaugeFactory:ethers.Contract = await deployOrLoad("GaugeFactory", GaugeFactory);
    const bribeFactory:ethers.Contract = await deployOrLoad("BribeFactory", BribeFactory);
    const library:ethers.Contract = await deployOrLoad("TokenLibrary", Library, [router2.address]);
    const artProxy:ethers.Contract = await deployOrLoad("VeArtProxy", VeArtProxy);
    const escrow:ethers.Contract = await deployOrLoad("VotingEscrow", VotingEscrow, [token.address, artProxy.address]);
    const distributor:ethers.Contract = await deployOrLoad("RewardsDistributor", RewardsDistributor, [escrow.address]);
    const voter:ethers.Contract = await deployOrLoad("Voter", Voter, [escrow.address, pairFactory.address, gaugeFactory.address, bribeFactory.address]);
    const externalBribeFactory:ethers.Contract = await deployOrLoad("WrappedExternalBribeFactory", WrappedExternalBribeFactory, [voter.address]);
    const minter:ethers.Contract = await deployOrLoad("Minter", Minter, [voter.address, escrow.address, distributor.address]);
    const governor:ethers.Contract = await deployOrLoad("TokenGovernor", TokenGovernor, [escrow.address]);
    const claim:ethers.Contract = await deployOrLoad("MerkleClaim", MerkleClaim, [token.address, CONFIG.merkleRoot]);

    README += `# Transactions:\n\n`;
    await tx(token, "initialMint", [CONFIG.teamTreasure, CONFIG.teamAmount] )
    await tx(token, "initialMint", [CONFIG.teamTreasure, CONFIG.teamAmount] )


    await tx(token, "setMerkleClaim", [claim.address] )
    await tx(token, "setMinter", [minter.address] )
    await tx(pairFactory, "setPauser", [CONFIG.teamEOA] )
    await tx(escrow, "setVoter", [voter.address] )
    await tx(escrow, "setTeam", [CONFIG.teamEOA] )
    await tx(voter, "setGovernor", [CONFIG.teamEOA] )
    await tx(voter, "setEmergencyCouncil", [CONFIG.teamEOA] )
    await tx(distributor, "setDepositor", [minter.address] )
    await tx(governor, "setTeam", [CONFIG.teamEOA] )
    const nativeToken = [token.address]
    const tokenWhitelist = nativeToken.concat(CONFIG.tokenWhitelist)
    await tx(voter, "initialize", [tokenWhitelist, minter.address] )

    let total:bigint = BigInt(0)
    for( let i in CONFIG.partnerAmts )
        total += BigInt(CONFIG.partnerAmts[i])
    await tx(minter, "initialize", [CONFIG.partnerAddrs, CONFIG.partnerAmts, total] )
    await tx(minter, "setTeam", [CONFIG.teamMultisig])

    fs.writeFileSync("readme.md", README);

}


async function verify(contract: any, args: any[] = []) {

    return true;

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

async function flatten(name:string, files:string[]) {
    let flattened = '';
    try {
        flattened = await hre.run("flatten:get-flattened-sources", {files});
        flattened = flattened.replaceAll(/SPDX-License-Identifier:/gm, "License-Identifier:");
        flattened = `// SPDX-License-Identifier: MIXED\n\n${flattened}`;
        flattened = flattened.replace(/pragma experimental ABIEncoderV2;\n/gm, ((i) => (m) => (!i++ ? m : ""))(0));
    } catch (e) {
        console.log(` - Flattening failed for ${name}`);
        console.log(e);
        return;
    }
    fs.writeFileSync(`flattened/${name}.sol`, flattened);
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
    //console.log(`# ${name} deployed at ${addr}`);
    return addr;
}

function get(name: string): string {
    if (CONTRACTS[name])
        return CONTRACTS[name];
    const cache = `contracts-${chainId}.json`;
    if (!fs.existsSync(cache))
        fs.writeFileSync(cache, "{}");
    const contracts = JSON.parse( fs.readFileSync(cache, "utf8") );
    // @ts-ignore
    const addr = contracts[name];
    CONTRACTS[name] = addr;
    return addr;
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
