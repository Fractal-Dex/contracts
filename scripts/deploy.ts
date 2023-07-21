import getDeploymentConfig from "../deployment-config";
import fs from "fs";
import {ethers} from "ethers";
let chainId: number, mainNet: boolean, testNet: boolean;
let CONTRACTS: any = {};
let CONFIG = {};
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
    //console.log(`# ${name} deployed at ${addr}`);
    return addr;
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

let README = "";
async function deployOrLoad(name: string, factory: any, args: any[] = []) {
    let addr = get(name);
    if (!addr) {
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
    return await hre.ethers.getContractAt(name, addr);
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
    CONFIG = getDeploymentConfig(mainNet);
    // public key from private key:
    deployer = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
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
    const token = await deployOrLoad("Token", Token);
    const pairFactory = await deployOrLoad("PairFactory", PairFactory);
    const router = await deployOrLoad("Router", Router, [pairFactory.address, CONFIG.WETH]);
    const router2 = await deployOrLoad("Router2", Router2, [pairFactory.address, CONFIG.WETH]);
    const gaugeFactory = await deployOrLoad("GaugeFactory", GaugeFactory);
    const bribeFactory = await deployOrLoad("BribeFactory", BribeFactory);
    const library = await deployOrLoad("TokenLibrary", Library, [router2.address]);
    const artProxy = await deployOrLoad("VeArtProxy", VeArtProxy);
    const escrow = await deployOrLoad("VotingEscrow", VotingEscrow, [token.address, artProxy.address]);
    const distributor = await deployOrLoad("RewardsDistributor", RewardsDistributor, [escrow.address]);
    const voter = await deployOrLoad("Voter", Voter, [escrow.address, pairFactory.address, gaugeFactory.address, bribeFactory.address]);
    const externalBribeFactory = await deployOrLoad("WrappedExternalBribeFactory", WrappedExternalBribeFactory, [voter.address]);
    const minter = await deployOrLoad("Minter", Minter, [voter.address, escrow.address, distributor.address]);
    const governor = await deployOrLoad("TokenGovernor", TokenGovernor, [escrow.address]);
    const claim = await deployOrLoad("MerkleClaim", MerkleClaim, [token.address, CONFIG.merkleRoot]);

    README += `# Transactions:\n\n`;
    await runTx("token.initialMint", token.initialMint(CONFIG.teamTreasure, CONFIG.teamAmount))
    await runTx("token.setMerkleClaim", token.setMerkleClaim(claim.address))
    await runTx("token.setMinter", token.setMinter(minter.address))
    await runTx("pairFactory.setPauser", pairFactory.setPauser(CONFIG.teamEOA))
    await runTx("escrow.setVoter", escrow.setVoter(voter.address))
    await runTx("escrow.setTeam", escrow.setTeam(CONFIG.teamEOA))
    await runTx("voter.setGovernor", voter.setGovernor(CONFIG.teamEOA))
    await runTx("voter.setEmergencyCouncil", voter.setEmergencyCouncil(CONFIG.teamEOA))
    await runTx("distributor.setDepositor", distributor.setDepositor(minter.address))
    await runTx("governor.setTeam", governor.setTeam(CONFIG.teamEOA))
    const nativeToken = [token.address]
    const tokenWhitelist = nativeToken.concat(CONFIG.tokenWhitelist)
    await runTx("voter.initialize", voter.initialize(tokenWhitelist, minter.address))

    let total:bigint = BigInt(0)
    for( let i in CONFIG.partnerAmts )
        total += BigInt(CONFIG.partnerAmts[i])
    await runTx("minter.initialize", minter.initialize(CONFIG.partnerAddrs, CONFIG.partnerAmts, total))
    await runTx("minter.setTeam", minter.setTeam(CONFIG.teamMultisig))

    fs.writeFileSync("readme.md", README);

}

async function runTx(name, transaction:Promise<any>){
    try{
        const tx = await transaction;
        tx.wait();
        const alias = tx.hash.substring(0, 6);
        README += ` - ${name}: [\`${alias}\`](${CONFIG.EXPLORER}tx/${tx.hash})\n`;
    }catch(e) {
        console.log(e);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
