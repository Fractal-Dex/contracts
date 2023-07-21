pragma solidity 0.8.13;

import "forge-std/Test.sol";
import "forge-std/console2.sol";
import "solmate/test/utils/mocks/MockERC20.sol";
import "../contracts/BribeFactory.sol";
import "../contracts/GaugeFactory.sol";
import "../contracts/PairFactory.sol";
import "../contracts/MerkleClaim.sol";
import "contracts/InternalBribe.sol";
import "contracts/ExternalBribe.sol";
import "contracts/Gauge.sol";
import "contracts/Minter.sol";
import "contracts/Pair.sol";
import "contracts/PairFees.sol";
import "contracts/RewardsDistributor.sol";
import "contracts/Router.sol";
import "contracts/Router2.sol";
import "contracts/Token.sol";
import "contracts/TokenLibrary.sol";
import "contracts/Voter.sol";
import "contracts/VeArtProxy.sol";
import "contracts/VotingEscrow.sol";
import "contracts/TokenGovernor.sol";
import "utils/TestOwner.sol";
import "utils/TestStakingRewards.sol";
import "utils/TestToken.sol";
import "utils/TestVoter.sol";
import "utils/TestVotingEscrow.sol";
import "utils/TestWETH.sol";
contract Emission is Test {
    TestWETH WETH;
    MockERC20 DAI;
    uint TOKEN_100 = 100 * 1e18;
    Token token;
    GaugeFactory gaugeFactory;
    BribeFactory bribeFactory;
    PairFactory pairFactory;
    Router2 router;
    VeArtProxy artProxy;
    VotingEscrow escrow;
    RewardsDistributor distributor;
    Voter voter;
    Minter minter;
    TokenGovernor governor;
    Pair pool_eth_dai;
    Pair pool_eth_token;
    address[] whitelist;
    Gauge gauge_eth_token;
    function setUp() public {
        token = new Token();
        gaugeFactory = new GaugeFactory();
        bribeFactory = new BribeFactory();
        pairFactory = new PairFactory();
        WETH = new TestWETH();
        DAI = new MockERC20("DAI", "DAI", 18);
        router = new Router2(address(pairFactory), address(WETH));
        artProxy = new VeArtProxy();
        escrow = new VotingEscrow(address(token), address(artProxy));
        distributor = new RewardsDistributor(address(escrow));
        voter = new Voter(address(escrow), address(pairFactory), address(gaugeFactory), address(bribeFactory));
        minter = new Minter(address(voter), address(escrow), address(distributor));
        governor = new TokenGovernor(escrow);
        // ---
        token.initialMint(address(this));
        token.setMinter(address(minter));
        escrow.setVoter(address(voter));
        escrow.setTeam(address(this));
        voter.setGovernor(address(this));
        voter.setEmergencyCouncil(address(this));
        distributor.setDepositor(address(minter));
        governor.setTeam(address(this));


        whitelist.push(address(token));
        whitelist.push(address(DAI));
        voter.initialize(whitelist, address(minter));
        //minter.initialize([], [], 0);
        minter.setTeam(address(this));

        // ---
        DAI.mint(address(this), TOKEN_100);
        DAI.approve(address(router), TOKEN_100);
        token.approve(address(router), TOKEN_100);

        router.addLiquidityETH{value : TOKEN_100}(address(DAI), false, TOKEN_100, 0, 0, address(this), block.timestamp);
        router.addLiquidityETH{value : TOKEN_100}(address(token), false, TOKEN_100, 0, 0, address(this), block.timestamp);

        pool_eth_dai = Pair( pairFactory.getPair(address(WETH),address(DAI), false) );
        pool_eth_token = Pair( pairFactory.getPair(address(WETH),address(token), false) );
    }
    function getEpoch() public returns(uint){
        InternalBribe bribe = InternalBribe(gauge_eth_token.internal_bribe());
        return bribe.getEpochStart(block.timestamp);
    }
    function testExec() public {
        vm.warp(block.timestamp + 86400 * 7);
        vm.roll(block.number + 1);

        gauge_eth_token = Gauge(voter.createGauge(address(pool_eth_token)));
        vm.roll(block.number + 1);
        uint duration = 4 * 365 * 86400;
        token.approve(address(escrow), token.balanceOf(address(this)));
        uint id = escrow.create_lock(token.balanceOf(address(this)), duration);

        address[] memory pools = new address[](1);
        pools[0] = address(pool_eth_token);
        uint256[] memory weights = new uint256[](1);
        weights[0] = 5000;
        console.log('epoch 0', getEpoch());
        vm.warp(block.timestamp + 86400 * 3);
        vm.roll(block.number + 1);
        voter.vote(id, pools, weights);
        voter.distro();
        console.log('epoch 0', getEpoch());
        vm.warp(block.timestamp + (86400 * 4)+ 1 );
        vm.roll(block.number + 1);
        console.log('epoch 1', getEpoch());

        address[] memory emptyAddresses = new address[](1);
        emptyAddresses[0] = address(this);
        uint[] memory emptyAmounts = new uint[](1);
        emptyAmounts[0] = 1e18;
        minter.initialize(emptyAddresses, emptyAmounts, 1e18);
        console.log('a', token.balanceOf(address(this))/1e18);
        voter.distro();
        console.log('b', token.balanceOf(address(this))/1e18);
        vm.warp(block.timestamp + (86400 * 7)+ 1 );
        vm.roll(block.number + 1);
        console.log('epoch 2', getEpoch());
        voter.distro();
        console.log('c', token.balanceOf(address(this))/1e18);
    }

}
