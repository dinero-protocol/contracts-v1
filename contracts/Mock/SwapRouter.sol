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

  function lpBalance(address _account, address _tokenA, address _tokenB) external view returns (uint256) {
    address pair = factory.getPair(_tokenA, _tokenB);
    return IERC20(pair).balanceOf(_account);
  }

  // Initialize the pair with some starting pair of amounts
  function init(
    address _tokenA,
    address _tokenB,
    uint256 _amountA,
    uint256 _amountB,
    address _to
  ) external {
    factory.createPair(_tokenA, _tokenB);
    IERC20(_tokenA).approve(address(router), 2**256 - 1);
    IERC20(_tokenB).approve(address(router), 2**256 - 1);
    router.addLiquidity(_tokenA, _tokenB, _amountA, _amountB, _amountA, _amountB, _to, block.timestamp + 1 weeks);
  }
}
