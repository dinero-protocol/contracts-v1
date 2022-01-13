// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV2Router02} from "../interface/IUniswapV2Router.sol";
import {IUniswapV2Factory} from "../interface/IUniswapV2Factory.sol";

contract SwapRouter {
  IUniswapV2Router02 public router;
  IUniswapV2Factory public factory;

  constructor(address _router, address _factory) {
    router = IUniswapV2Router02(_router);
    factory = IUniswapV2Factory(_factory);
  }

  // Initialize the pair with some starting pair of amounts
  function init(
    address tokenA,
    address tokenB,
    uint256 amountA,
    uint256 amountB,
    address to
  ) external {
    factory.createPair(tokenA, tokenB);
    IERC20(tokenA).approve(address(router), 1000000000000000);
    IERC20(tokenB).approve(address(router), 1000000000000000);
    router.addLiquidity(tokenA, tokenB, amountA, amountB, amountA, amountB, to, block.timestamp + 1 weeks);
  }
}
