pragma solidity 0.8.13;

import './BaseTest.sol';
import "contracts/TvlOracle.sol";
import "contracts/Token.sol";

contract TvlOracleTest is BaseTest {
    uint TOKEN_100 = 100 * 1e18;
    uint TOKEN_100e6 = 100 * 1e6;
    TvlOracle oracle;
    TvlOracle oracle_token;
    Pair poolToken;
    function setUp() public {
        deployCoins();
        factory = new PairFactory();
        router2 = new Router2(address(factory), address(WETH));

        // weth/usdc
        USDC.mint(address(this), TOKEN_100e6);
        USDC.approve(address(router2), TOKEN_100e6);
        router2.addLiquidityETH{value : TOKEN_100}(address(USDC), false, TOKEN_100e6, 0, 0, address(this), block.timestamp);
        pair = Pair(factory.getPair(address(USDC), address(WETH), false));

        // token/usdc
        USDC.mint(address(this), TOKEN_100e6);
        USDC.approve(address(router2), TOKEN_100e6);
        Token.mint(address(this), TOKEN_100);
        Token.approve(address(router2), TOKEN_100);
        router2.addLiquidity(address(Token), address(USDC), false, TOKEN_100, TOKEN_100e6, 0, 0, address(this), block.timestamp);
        poolToken = Pair(factory.getPair(address(USDC), address(Token), false));

        address[3] memory uwl = [address(USDC), address(WETH), address(pair)];
        oracle = new TvlOracle(uwl, 6);

        address[3] memory uwl_token = [address(USDC), address(Token), address(poolToken)];
        oracle_token = new TvlOracle(uwl_token, 6);

    }

    function testCmd() public{
        Router.route[] memory routes = new Router.route[](1);
        routes[0] = Router.route(address(WETH), address(USDC), false);
        router2.swapExactETHForTokensSupportingFeeOnTransferTokens{value: TOKEN_1}(0, routes, address(this), block.timestamp);

        uint price_eth = oracle.p_t_coin_usd(address(pair));
        console2.log('eth/usdc price', price_eth);

        uint price_token = oracle.p_t_coin_usd(address(poolToken));
        console2.log('token/usdc price', price_token);

    }
}
