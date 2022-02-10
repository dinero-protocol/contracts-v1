// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";

interface IBTRFLY is IERC20 {
    function burn(uint256 amount) external;

    function decimals() external view returns (uint8);
}

interface IRedactedTreasury {
    function manage(address _token, uint256 _amount) external;
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

    function token() external view returns (address);
}

contract ThecosomataETH is Ownable {
    address public immutable BTRFLY;
    address public immutable WETH;
    address public immutable CURVEPOOL;
    address public immutable TREASURY;

    uint256 private immutable _btrflyDecimals;
    uint256 private immutable _ethDecimals;

    event AddLiquidity(
        uint256 ethLiquidity,
        uint256 btrflyLiquidity,
        uint256 btrflyBurned
    );

    constructor(
        address _BTRFLY,
        address _WETH,
        address _TREASURY,
        address _CURVEPOOL
    ) {
        require(_BTRFLY != address(0), "Invalid BTRFLY address");
        BTRFLY = _BTRFLY;

        require(_WETH != address(0), "Invalid WETH address");
        WETH = _WETH;

        require(_CURVEPOOL != address(0), "Invalid POOL address");
        CURVEPOOL = _CURVEPOOL;

        require(_TREASURY != address(0), "Invalid TREASURY address");
        TREASURY = _TREASURY;

        IERC20(_BTRFLY).approve(_CURVEPOOL, 2**256 - 1);
        IERC20(_WETH).approve(_CURVEPOOL, 2**256 - 1);

        _btrflyDecimals = IBTRFLY(_BTRFLY).decimals();
        _ethDecimals = IBTRFLY(_WETH).decimals();
    }

    function checkUpkeep()
        public
        view
        returns (bool upkeepNeeded)
    {
        if (IBTRFLY(BTRFLY).balanceOf(address(this)) > 0) {
            return true;
        }
    }

    function calculateAmountRequiredForLP(uint256 amount, bool isBTRFLY)
        internal
        view
        returns (uint256)
    {
        // Default price is from ETH to BTRFLY (in 18 decimals)
        uint256 priceOracle = ICurveCryptoPool(CURVEPOOL).price_oracle();

        if (isBTRFLY) {
            return (((amount * priceOracle) / (10**18)) * (10**_ethDecimals)) /
                (10**_btrflyDecimals);
        }

        return
            (((amount * (10**18)) / priceOracle) *
                (10**_btrflyDecimals)) / (10**_ethDecimals);
    }

    function addLiquidity(uint256 ethAmount, uint256 btrflyAmount) internal {
        uint256[2] memory amounts = [ethAmount, btrflyAmount];
        uint256 expectedAmount = ICurveCryptoPool(CURVEPOOL).calc_token_amount(
            amounts
        );

        ICurveCryptoPool(CURVEPOOL).add_liquidity(amounts, expectedAmount);
    }

    function performUpkeep() external onlyOwner {
        require(checkUpkeep(), "Invalid upkeep state");

        uint256 btrfly = IBTRFLY(BTRFLY).balanceOf(address(this));
        uint256 ethAmount = calculateAmountRequiredForLP(btrfly, true);
        uint256 ethCap = IERC20(WETH).balanceOf(TREASURY);
        uint256 ethLiquidity = ethCap > ethAmount ? ethAmount : ethCap;

        // Use BTRFLY balance if remaining capacity is enough, otherwise, calculate BTRFLY amount
        uint256 btrflyLiquidity = ethCap > ethAmount
            ? btrfly
            : calculateAmountRequiredForLP(ethLiquidity, false);

        IRedactedTreasury(TREASURY).manage(WETH, ethLiquidity);

        // Only complete upkeep only on sufficient amounts
        require(ethLiquidity > 0 && btrflyLiquidity > 0, "Insufficient amounts");
        addLiquidity(ethLiquidity, btrflyLiquidity);

        // Transfer out the pool token to treasury
        address token = ICurveCryptoPool(CURVEPOOL).token();
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(TREASURY, tokenBalance);

        uint256 unusedBTRFLY = IBTRFLY(BTRFLY).balanceOf(address(this));

        if (unusedBTRFLY > 0) {
            IBTRFLY(BTRFLY).burn(unusedBTRFLY);
        }

        emit AddLiquidity(ethLiquidity, btrflyLiquidity, unusedBTRFLY);
    }

    function withdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        IERC20(token).transfer(recipient, amount);
    }
}
