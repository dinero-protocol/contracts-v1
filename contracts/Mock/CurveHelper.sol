// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface ICurveDeployer {
    function deploy_pool(
        string calldata name,
        string calldata symbol,
        address[2] calldata coins,
        uint256 a,
        uint256 gamma,
        uint256 midFee,
        uint256 outFee,
        uint256 extraProfit,
        uint256 feeGamma,
        uint256 adjustmentStep,
        uint256 adminFee,
        uint256 maHalfTime,
        uint256 initialPrice
    ) external payable;

    function find_pool_for_coins(
        address from,
        address to,
        uint256 i
    ) external view returns (address);
}

interface ICurveCryptoPool {
    function add_liquidity(uint256[2] calldata amounts, uint256 min_mint_amount)
        external
        payable;

    function calc_token_amount(uint256[2] calldata amounts)
        external
        view
        returns (uint256);

    // Would be replaced by Chainlink based oracle
    function price_oracle() external view returns (uint256);
}

interface IWETH {
    function deposit() external payable;

    function transfer(address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);
}

contract CurveHelper {
    ICurveDeployer public deployer;
    IWETH public weth;
    address public btrfly;

    constructor(
        address _deployer,
        address _btrfly,
        address _weth
    ) {
        deployer = ICurveDeployer(_deployer);
        weth = IWETH(_weth);
        btrfly = _btrfly;

        address[2] memory coins = [_weth, _btrfly];

        deployer.deploy_pool(
            "ETH/BTRFLY",
            "ETHBTRFLY",
            coins,
            400000,
            145000000000000,
            26000000,
            45000000,
            2000000000000,
            230000000000000,
            146000000000000,
            5000000000,
            600,
            200000000000000000
        );
    }

    function poolAddress() public view returns (address) {
        return deployer.find_pool_for_coins(address(weth), btrfly, 0);
    }

    function initPool(uint256 amount1, uint256 amount2) external {
        address pool = poolAddress();
        uint256[2] memory amounts = [amount1, amount2];
        IERC20(btrfly).approve(pool, 2**256 - 1);
        IWETH(weth).approve(pool, 2**256 - 1);
        ICurveCryptoPool(pool).add_liquidity(amounts, 0);
    }

    // Mainly used for mocking WETH for treasury
    function wrapAndTransfer(address to, uint256 amount) external payable {
        weth.deposit{value: msg.value}();
        weth.transfer(to, amount);
    }
}
