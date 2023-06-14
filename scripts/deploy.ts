import getDeploymentConfig from "../deployment-config";
import fs from "fs";
let chainId: number, mainNet: boolean, testNet: boolean;
let CONTRACTS: any = {};
let tx; // running tx variable to wait for execution

function get(name: string): string {
    if (CONTRACTS[name])
        return CONTRACTS[name];
    const cache = `../contracts-${chainId}.json`;
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
    const cache = `../contracts-${chainId}.json`;
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
    if (! mainNet && ! testNet) return;
    const addr = contract.address;
    const verifyArgs = {
        address: addr,
        constructorArguments: args,
    };
    try {
        await contract.deployTransaction.wait(5);
        hre.run("verify:verify", verifyArgs);
    } catch (e) {
        console.log(`# Verification failed for ${addr}`);
        console.log(`# verifyArgs:`, verifyArgs);
        console.log(e);
    }
}

async function main() {
    const network = await hre.ethers.provider.getNetwork();
    chainId = network.chainId;
    mainNet = chainId === 5000;
    testNet = chainId === 5001;
    const CONFIG = getDeploymentConfig(mainNet);
    // public key from private key:
    const signer = new hre.ethers.Wallet(process.env.PRIVATE_KEY);
    console.log(`#Network: ${chainId}, deployer: ${signer.address}`);
    return;

    // Load
    const [
        UniswapV2Oracle,
        Token,
        Option,
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
        hre.ethers.getContractFactory("UniswapV2Oracle"),
        hre.ethers.getContractFactory("Token"),
        hre.ethers.getContractFactory("Option"),
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

    const magma = await Option.deploy();
    await magma.deployed();
    set("Option", magma.address);
    await verify(magma);

    // deploy router and factory to be able to create the pair for oracle:

    const pairFactory = await PairFactory.deploy();
    await pairFactory.deployed();
    set("PairFactory", pairFactory.address);
    await verify(pairFactory);

    const routerArgs = [pairFactory.address, CONFIG.WETH];
    const router = await Router.deploy(...routerArgs);
    await router.deployed();
    set("Router", router.address);
    await verify(router, routerArgs);

    const router2 = await Router2.deploy(...routerArgs);
    await router2.deployed();
    set("Router2", router2.address);
    await verify(router2, routerArgs);

    // create pair for oracle:
    const oraclePair = await pairFactory.createPair(CONFIG.WETH, magma.address);
    await oraclePair.deployed();
    const oraclePairAddress = await pairFactory.getPair(CONFIG.WETH, magma.address);
    set("OraclePair", oraclePairAddress);

    // deploy the oracle:
    const oracleArgs = [
        oraclePairAddress,
        CONFIG.WETH,
    ];
    const oracle = await UniswapV2Oracle.deploy(...oracleArgs);
    await oracle.deployed();
    set("Oracle", oracle.address);
    await verify(oracle, oracleArgs);

    // deploy option token:
    const oOptionArgs = [
        "Option Option",
        "oOption",
        CONFIG.teamEOA,
        CONFIG.WETH,
        CONTRACTS.Option,
        CONTRACTS.Oracle,
    ];
    const omagma = await Token.deploy(...oOptionArgs);
    await omagma.deployed();
    set("oOption", magma.address);
    await verify(omagma, oOptionArgs);
    // allow option token to mint Option:
    tx = await magma.setRedemptionReceiver(omagma.address);
    await tx.wait();
    // set option treasure, this is where option payment goes:
    tx = await omagma.setTreasury(CONFIG.teamTreasure);

    const gaugeFactory = await GaugeFactory.deploy();
    await gaugeFactory.deployed();
    set("GaugeFactory", gaugeFactory.address);
    await verify(gaugeFactory);

    const bribeFactory = await BribeFactory.deploy();
    await bribeFactory.deployed();
    set("BribeFactory", bribeFactory.address);
    await verify(bribeFactory);

    const libraryArgs = [router2.address];
    const library = await Library.deploy(...libraryArgs);
    await library.deployed();
    set("Library", library.address);
    await verify(library, libraryArgs);

    const artProxy = await VeArtProxy.deploy();
    await artProxy.deployed();
    set("VeArtProxy", artProxy.address);
    await verify(artProxy);

    const escrowArgs = [magma.address, artProxy.address];
    const escrow = await VotingEscrow.deploy(...escrowArgs);
    await escrow.deployed();
    set("VotingEscrow", escrow.address);
    await verify(escrow, escrowArgs);

    const distributorArgs = [escrow.address];
    const distributor = await RewardsDistributor.deploy(...distributorArgs);
    await distributor.deployed();
    set("RewardsDistributor", distributor.address);
    await verify(distributor, distributorArgs);

    const voterArgs = [
        escrow.address,
        pairFactory.address,
        gaugeFactory.address,
        bribeFactory.address
    ];
    const voter = await Voter.deploy(...voterArgs);
    await voter.deployed();
    set("Voter", voter.address);
    await verify(voter, voterArgs);

    const externalBribeFactoryArgs = [voter.address];
    const externalBribeFactory = await WrappedExternalBribeFactory.deploy(...externalBribeFactoryArgs);
    await externalBribeFactory.deployed();
    set("WrappedExternalBribeFactory", externalBribeFactory.address);
    await verify(externalBribeFactory, externalBribeFactoryArgs);

    const minterArgs = [ voter.address,
        escrow.address,
        distributor.address ];
    const minter = await Minter.deploy(...minterArgs);
    await minter.deployed();
    set("Minter", minter.address);
    await verify(minter, minterArgs);
    tx = await omagma.addMinter(minter.address);
    await tx.wait();

    const governorArgs = [escrow.address];
    const governor = await TokenGovernor.deploy(...governorArgs);
    await governor.deployed();
    set("TokenGovernor", escrow.address);
    await verify(governor, governorArgs);

    const claimArgs = [magma.address, CONFIG.merkleRoot];
    const claim = await MerkleClaim.deploy(...claimArgs);
    await claim.deployed();
    set("MerkleClaim", claim.address);
    await verify(claim, claimArgs);


    // Initialize
    tx = await magma.initialMint(CONFIG.teamTreasure, CONFIG.teamAmount);
    tx.wait();

    tx = await magma.addMinter(claim.address);
    tx.wait();

    tx = await magma.addMinter(minter.address);
    tx.wait();

    tx = await pairFactory.setPauser(CONFIG.teamEOA);
    tx.wait();

    tx = await escrow.setVoter(voter.address);
    tx.wait();

    tx = await escrow.setTeam(CONFIG.teamEOA);
    tx.wait();

    tx = await voter.setGovernor(CONFIG.teamEOA);
    tx.wait();

    tx = await voter.setEmergencyCouncil(CONFIG.teamEOA);
    tx.wait();

    tx = await distributor.setTeam(minter.address);
    tx.wait();

    tx = await distributor.setDepositor(minter.address);
    tx.wait();

    tx = await governor.setTeam(CONFIG.teamEOA)
    tx.wait();


    // Whitelist
    const nativeToken = [magma.address];
    const tokenWhitelist = nativeToken.concat(CONFIG.tokenWhitelist);
    tx = await voter.initialize(tokenWhitelist, minter.address);
    tx.wait();

    tx = await minter.initialize(CONFIG.partnerAddrs, CONFIG.partnerAmts);
    tx.wait();

    tx = await minter.setTeam(CONFIG.teamMultisig)
    tx.wait();

    console.log(`Deployment finished for chain: ${chainId}`);
    for (let i in CONTRACTS) {
        console.log(` - ${i} = ${CONTRACTS[i]}`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
