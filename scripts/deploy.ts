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
    let flattened = await hre.run("flatten:get-flattened-sources", { files });

    // Remove every line started with "// SPDX-License-Identifier:"
    flattened = flattened.replace(/SPDX-License-Identifier:/gm, "License-Identifier:");
    flattened = `// SPDX-License-Identifier: MIXED\n\n${flattened}`;

    // Remove every line started with "pragma experimental ABIEncoderV2;" except the first one
    flattened = flattened.replace(/pragma experimental ABIEncoderV2;\n/gm, ((i) => (m) => (!i++ ? m : ""))(0));
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
    README += `- [${abiFile}](${name}): [${CONFIG.EXPLORER}address/${addr}](\`${addr}\`)\n`;
    return await hre.ethers.getContractAt(name, addr);
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
    console.log(README);
    fs.writeFileSync("readme.md", README);

    return;
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

    try{
        tx = await token.initialMint(CONFIG.teamTreasure, CONFIG.teamAmount);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try{
        tx = await token.setMerkleClaim(claim.address);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try{
        tx = await token.setMinter(minter.address);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try{
        tx = await pairFactory.setPauser(CONFIG.teamEOA);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try {
        tx = await escrow.setVoter(voter.address);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try {
        tx = await escrow.setTeam(CONFIG.teamEOA);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try {
        tx = await voter.setGovernor(CONFIG.teamEOA);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try {
        tx = await voter.setEmergencyCouncil(CONFIG.teamEOA);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try {
        tx = await distributor.setDepositor(minter.address);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try {
        tx = await governor.setTeam(CONFIG.teamEOA)
        tx.wait();
    }catch(e){
        console.log(e);
    }


    try{
        const nativeToken = [token.address];
        const tokenWhitelist = nativeToken.concat(CONFIG.tokenWhitelist);
        tx = await voter.initialize(tokenWhitelist, minter.address);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try{
        let total:bigint = BigInt(0);
        for( let i in CONFIG.partnerAmts ){
            total += BigInt(CONFIG.partnerAmts[i]);
        }
        tx = await minter.initialize(CONFIG.partnerAddrs, CONFIG.partnerAmts, total);
        tx.wait();
    }catch(e){
        console.log(e);
    }

    try{
        tx = await minter.setTeam(CONFIG.teamMultisig)
        tx.wait();
    }catch(e){
        console.log(e);
    }

}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
