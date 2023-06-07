import { ethers } from "ethers";
const TEAM_MULTISIG = "0x79dE631fFb7291Acdb50d2717AE32D44D5D00732";
const TEAM_EOA = "0x7cef2432A2690168Fb8eb7118A74d5f8EfF9Ef55";
const WETH = "0xc86c7C0eFbd6A49B35E8714C5f59D99De09A225b";
const USDC = "0xfA9343C3897324496A05fC75abeD6bAC29f8A40f";
const mainnet_config = {
  WETH: WETH,
  USDC: USDC,
  USDC_DECIMALS: 6,
  wKAVA_USDC: "0x5c27a0d0e6d045b5113d728081268642060f7499",
  VARA_USDC: "0x9bf1E3ee61cBe5C61E520c8BEFf45Ed4D8212a9A",
  VARA_KAVA: "0x7d8100072ba0e4da8dc6bd258859a5dc1a452e05",
  POOL2: "0xCa0d15B4BB6ad730fE40592f9E25A2E052842c92",
  teamEOA: TEAM_EOA,
  teamTreasure: '0x3a724E0082b0E833670cF762Ea6bd711bcBdFf37',
  teamMultisig: TEAM_MULTISIG,
  emergencyCouncil: "0x7cef2432A2690168Fb8eb7118A74d5f8EfF9Ef55",
  merkleRoot: "0x6362f8fcdd558ac55b3570b67fdb1d1673bd01bd53302e42f01377f102ac80a9",
  tokenWhitelist: [],
  partnerAddrs: [

  ],
  partnerAmts: [

  ],
};

export default mainnet_config;
