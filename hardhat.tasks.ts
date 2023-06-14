import {task} from "hardhat/config";
import fs from "fs";

async function loadCfg() {
    const network = await hre.ethers.provider.getNetwork();
    const chainId = network.chainId;
    const cache = `./contracts-${chainId}.json`;
    const contracts = JSON.parse(fs.readFileSync(cache).toString());
    if (!contracts) {
        new Error(`${cache} is empty.`);
    }
    const [owner] = await hre.ethers.getSigners();
    return contracts;
}

task("bribeInfo", "stats about bribes").setAction(async () => {
    const cfg = await loadCfg();
    const IERC20 = await ethers.getContractFactory("contracts/Token.sol:Option")
    const Pair = await ethers.getContractFactory("contracts/Pair.sol:Pair")
    const Main = await ethers.getContractFactory("contracts/Voter.sol:Voter")
    const Gauge = await ethers.getContractFactory("contracts/Gauge.sol:Gauge")
    const ExternalBribe = await ethers.getContractFactory("contracts/ExternalBribe.sol:ExternalBribe")
    const main = Main.attach(cfg.Voter);
    const length = await main.length();
    let lines = [];
    for (let i = 0; i < length; ++i) {
        const poolAddress = await main.pools(i);
        const gaugeAddress = await main.gauges(poolAddress);
        const gauge = await Gauge.attach(gaugeAddress);
        const isAlive = await main.isAlive(gaugeAddress);
        const pool = await Pair.attach(poolAddress);
        const symbol = await pool.symbol();
        const fees = await pool.fees();
        const internal_bribe = await gauge.internal_bribe();
        const external_bribe = await gauge.external_bribe();
        const bribe = await ExternalBribe.attach(external_bribe);
        const rewardsListLength = (await bribe.rewardsListLength()).toString();

        if( isAlive ) {
            console.log(`${i}: ${symbol}`);
        }else{
            console.log(`${i}: ${symbol} [DEAD]`);
        }
        for( let j = 0; j < rewardsListLength; j++ ){
            const reward = await bribe.rewards(j);
            const token = IERC20.attach(reward);
            const symbol = await token.symbol();
            const balanceOfBribe = (await token.balanceOf(internal_bribe)).toString();
            const decimals = (await token.decimals()).toString();
            const amount = ethers.utils.formatUnits(balanceOfBribe, decimals);
            if( balanceOfBribe > 0 )
                console.log(` - ${symbol}: ${amount}`);

        }
    }
});


task("gaugeInfo", "Voter.distributeFees").setAction(async () => {
    const cfg = await loadCfg();
    const Pair = await ethers.getContractFactory("contracts/Pair.sol:Pair")
    const Main = await ethers.getContractFactory("contracts/Voter.sol:Voter")
    const Gauge = await ethers.getContractFactory("contracts/Gauge.sol:Gauge")
    const main = Main.attach(cfg.Voter);
    const length = await main.length();
    let lines = [];
    for (let i = 0; i < length; ++i) {
        const poolAddress = await main.pools(i);
        const gaugeAddress = await main.gauges(poolAddress);
        const gauge = await Gauge.attach(gaugeAddress);
        const isAlive = await main.isAlive(gaugeAddress);
        const pool = await Pair.attach(poolAddress);
        const symbol = await pool.symbol();
        const fees = await pool.fees();
        const internal_bribe = await gauge.internal_bribe();
        const external_bribe = await gauge.external_bribe();
        lines.push('-----------------------------------------------------------')
        if( isAlive ) {
            lines.push(` - ${i}: Gauge: ${gaugeAddress} ${symbol}`);
        }else{
            lines.push(` - ${i}: Gauge: ${gaugeAddress} ${symbol} [DEAD]`);
        }
        lines.push(`     Pool: ${poolAddress}`);
        lines.push(`     Pair Fees: ${fees}`);
        lines.push(`     Internal Bribe: ${internal_bribe}`);
        lines.push(`     External Bribe: ${external_bribe}`);
    }
    const str = lines.join('\n');
    console.log(str);
    fs.writeFileSync('./gaugeInfo.txt', str);
});

task("genKey", "generate a new private key").setAction(async () => {
    const wallet = hre.ethers.Wallet.createRandom();
    console.log(`ADDRESS=${wallet.address}`);
    console.log(`MNEMONIC=${wallet.mnemonic.phrase}`);
    console.log(`PRIVATE_KEY=${wallet.privateKey}`);
});

task("distro", "Voter.distro").setAction(async () => {
    const cfg = await loadCfg();
    const Main = await hre.ethers.getContractFactory("contracts/Voter.sol:Voter")
    const main = Main.attach(cfg.Voter);
    const tx = await main.distro();
    console.log(`${tx.hash}`);
});

task("updateAll", "Voter.updateAll").setAction(async () => {
    const cfg = await loadCfg();
    const Main = await hre.ethers.getContractFactory("Voter")
    const main = Main.attach(cfg.Voter);
    const tx = await main.updateAll();
    console.log(`${tx.hash}`);
});

task("distributeFees", "Voter.distributeFees").setAction(async () => {
    // const cfg = await loadCfg();
    const Pair = await ethers.getContractFactory("contracts/Pair.sol:Pair")
    const Main = await ethers.getContractFactory("contracts/Voter.sol:Voter")
    //const main = Main.attach(cfg.Voter);
    const main = Main.attach('0xa8B1E1B4333202355785C90fB434964046ef2E64');
    let pools = [], gauges = [];
    const length = await main.length();
    for (let i = 0; i < length; ++i) {
        const pool = await main.pools(i);
        const gauge = await main.gauges(pool);
        const isGauge = await main.isGauge(gauge);
        const isAlive = await main.isAlive(gauge);
        const token = await Pair.attach(pool);
        const symbol = await token.symbol();
        console.log(` - ${i}: ${pool} = ${gauge} isGauge=${isGauge} isLive=${isAlive} ${symbol}`);
        pools.push(pool);
        gauges.push(gauge);
    }
    let tx = await main.distributeFees(gauges);
    console.log(`${tx.hash}`);
});

task("gauges", "Voter.distributeFees").setAction(async () => {
    // const cfg = await loadCfg();
    const Pair = await ethers.getContractFactory("contracts/Pair.sol:Pair")
    const Main = await ethers.getContractFactory("contracts/Voter.sol:Voter")
    //const main = Main.attach(cfg.Voter);
    const main = Main.attach('0x4eB2B9768da9Ea26E3aBe605c9040bC12F236a59');
    let pools = [], gauges = [];
    const length = await main.length();
    for (let i = 0; i < length; ++i) {
        const pool = await main.pools(i);
        const gauge = await main.gauges(pool);
        const isGauge = await main.isGauge(gauge);
        const isAlive = await main.isAlive(gauge);
        const token = await Pair.attach(pool);
        const symbol = await token.symbol();
        console.log(` - ${i}: ${gauge} ${symbol}`);
        pools.push(pool);
        gauges.push(gauge);
    }
});

task("showFees", "showFees").setAction(async () => {
    const cfg = await loadCfg();
    const IERC20 = await ethers.getContractFactory("contracts/Token.sol:Option")
    const Main = await ethers.getContractFactory("contracts/Voter.sol:Voter")
    const Gauge = await ethers.getContractFactory("contracts/Gauge.sol:Gauge")
    const InternalBribe = await ethers.getContractFactory("contracts/InternalBribe.sol:InternalBribe")
    const main = Main.attach(cfg.Voter);
    const length = await main.length();
    for (let i = 0; i < length; ++i) {
        const poolAddress = await main.pools(i);
        const gaugeAddress = await main.gauges(poolAddress);
        const gauge = Gauge.attach(gaugeAddress);
        const bribeAddress = await gauge.internal_bribe();

        const bribe = InternalBribe.attach(bribeAddress);
        const rewardsListLength = await bribe.rewardsListLength();
        console.log(`bribe ${i} ${bribeAddress} = ${poolAddress}`);
        for( let j = 0; j < rewardsListLength; j++ ){
            const reward = await bribe.rewards(j);
            const token = IERC20.attach(reward);
            const symbol = await token.symbol();
            const balanceOfBribe = await token.balanceOf(bribeAddress);
            console.log(` - ${j} ${symbol}: ${balanceOfBribe}`);

        }
    }
});

task("batchRewardPerToken", "Gauge.batchRewardPerToken").setAction(async () => {
    const cfg = await loadCfg();
    const Main = await ethers.getContractFactory("Voter")
    const Gauge = await ethers.getContractFactory("Gauge")
    const main = Main.attach(cfg.Voter);
    const length = await main.length();
    for (let i = 0; i < length; ++i) {
        const poolAddress = await main.pools(i);
        const gaugeAddress = await main.gauges(poolAddress);
        const gauge = Gauge.attach(gaugeAddress);
        console.log(`- ${i}: ${poolAddress} = ${gaugeAddress}`);
        const supplyNumCheckpoints = await gauge.supplyNumCheckpoints();
        const earned1 = await gauge.earned(cfg.Option, process.env.MULTISIG);
        let tx = await gauge.batchRewardPerToken(cfg.Option, supplyNumCheckpoints);
        const earned2 = await gauge.earned(cfg.Option, process.env.MULTISIG);
        console.log(`  - maxRuns=${supplyNumCheckpoints}, earned1=${earned1}, earned2=${earned2}`);
        console.log(`  - tx=${tx.hash}`);
    }
});

task("earned", "Gauge.earned").setAction(async () => {
    const cfg = await loadCfg();
    const Main = await ethers.getContractFactory("Voter")
    const Gauge = await ethers.getContractFactory("Gauge")
    const main = Main.attach(cfg.Voter);
    const length = await main.length();
    for (let i = 0; i < length; ++i) {
        const poolAddress = await main.pools(i);
        const gaugeAddress = await main.gauges(poolAddress);
        const gauge = Gauge.attach(gaugeAddress);
        const earned = await gauge.earned(cfg.Option, process.env.MULTISIG);
        const derivedBalance = await gauge.derivedBalance(process.env.MULTISIG);
        console.log(`- ${i}: gauge: ${gaugeAddress}, earned: ${earned}, balance: ${derivedBalance}`);
    }
});
task("rewardPerToken", "Gauge.rewardPerToken").setAction(async () => {
    const cfg = await loadCfg();
    const Main = await ethers.getContractFactory("Voter")
    const Gauge = await ethers.getContractFactory("Gauge")
    const main = Main.attach(cfg.Voter);
    const length = await main.length();
    for (let i = 0; i < length; ++i) {
        const poolAddress = await main.pools(i);
        const gaugeAddress = await main.gauges(poolAddress);
        const gauge = Gauge.attach(gaugeAddress);
        const rewardsListLength = await gauge.rewardsListLength();
        for (let j = 0; j < rewardsListLength; j++) {
            const rewardAddress = await gauge.rewards(j);
            const rewardPerToken = await gauge.rewardPerToken(rewardAddress);
            console.log(`- ${i}/${j}: gauge: ${gaugeAddress}, reward: ${rewardAddress}, rewardPerToken: ${rewardPerToken}`);
        }
    }
});


task("getFees", "getFees")
    .addParam("id", "id")
    .setAction(async (taskArgs) => {
        const tokenId = taskArgs.id;
        const cfg = await loadCfg();
        const Main = await ethers.getContractFactory("Voter")
        const Gauge = await ethers.getContractFactory("Gauge")
        const InternalBribe = await ethers.getContractFactory("InternalBribe")
        const ExternalBribe = await ethers.getContractFactory("ExternalBribe")
        const main = Main.attach(cfg.Voter);
        const length = await main.length();
        for (let i = 0; i < length; ++i) {
            const poolAddress = await main.pools(i);
            const gaugeAddress = await main.gauges(poolAddress);
            const gauge = Gauge.attach(gaugeAddress);
            const internal_bribe = await gauge.internal_bribe();
            const external_bribe = await gauge.external_bribe();
            const internalBribe = InternalBribe.attach(internal_bribe);
            const externalBribe = ExternalBribe.attach(external_bribe);
            console.log(`${i}: gauge: ${gaugeAddress}, internal: ${internal_bribe}, external: ${external_bribe}`);

            let balanceOf = await internalBribe.balanceOf(tokenId);
            if (balanceOf > 0) {
                let rewardsListLength = await internalBribe.rewardsListLength();
                console.log(` - internalBribe ${rewardsListLength}, balanceOf: ${balanceOf}`);
                let rewards = [];
                for (let j = 0; j < rewardsListLength; j++) {
                    const rewardToken = await internalBribe.rewards(j);
                    const earned = await internalBribe.earned(rewardToken, tokenId);
                    const left = await internalBribe.left(rewardToken);
                    if( earned > 0 )
                        console.log(`  - ${j}: token: ${rewardToken} = ${earned}, left: ${left}`);
                    rewards.push(rewardToken);
                }
            }

            balanceOf = await externalBribe.balanceOf(tokenId);
            if (balanceOf > 0) {
                const rewardsListLength = await externalBribe.rewardsListLength();
                console.log(` - externalBribe ${rewardsListLength}, balanceOf: ${balanceOf}`);
                const rewards = [];
                for (let j = 0; j < rewardsListLength; j++) {
                    const rewardToken = await externalBribe.rewards(j);
                    const earned = await externalBribe.earned(rewardToken, tokenId);
                    const left = await externalBribe.left(rewardToken);
                    if( earned > 0 )
                        console.log(`  - ${j}: token: ${rewardToken} = ${earned}, left: ${left}`);
                    rewards.push(rewardToken);
                }
            }
        }
    });


task("merkleRoot", "MerkleClaim.merkleRoot").setAction(async () => {
    // const cfg = await loadCfg();
    const Main = await ethers.getContractFactory("MerkleClaim")
    const Option = await ethers.getContractFactory("Option")
    const main = Main.attach('0x6C54e61E0295b6f22d8F91CEd5ddE712f2061eE0');
    const merkleRoot = await main.merkleRoot();
    const magmaAddress = await main.oToken();
    const magma = Option.attach(magmaAddress);
    const merkleClaim = await magma.merkleClaim();
    const minter = await magma.minter();
    console.log(`oToken: ${magmaAddress}`);
    console.log(`- Option.merkleRoot: ${merkleRoot}`);
    console.log(`- Option.merkleClaim: ${merkleClaim}`);
    console.log(`- Option.minter: ${minter}`);
});

task("gen-privkey", "gen-privkey").setAction(async () => {
    const wallet = ethers.Wallet.createRandom();
    console.log(wallet.privateKey);
});
