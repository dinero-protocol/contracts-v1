// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract CVX is ERC20 {
  constructor() ERC20('DAI Stablecoin', 'DAI') {}

  function mint(address to) public {
    _mint(to, 100000 ether);
  }
}
