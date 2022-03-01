// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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

contract ThecosomataETH is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public immutable KEEPER_ROLE = keccak256("KEEPER_ROLE");

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
    event Withdraw(
        address token,
        uint256 amount,
        address recipient
    );
    event GrantKeeperRole(address keeper);
    event RevokeKeeperRole(address keeper);

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

        // Approve for max capacity
        IERC20(_BTRFLY).approve(_CURVEPOOL, type(uint256).max);
        IERC20(_WETH).approve(_CURVEPOOL, type(uint256).max);

        _btrflyDecimals = IBTRFLY(_BTRFLY).decimals();
        _ethDecimals = IBTRFLY(_WETH).decimals();

         _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Grant the keeper role for the specified address
    function grantKeeperRole(address keeper)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(keeper != address(0), "Invalid address");
        _grantRole(KEEPER_ROLE, keeper);

        emit GrantKeeperRole(keeper);
    }

    // Revoke the keeper role from the specified address
    function revokeKeeperRole(address keeper)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(hasRole(KEEPER_ROLE, keeper), "Invalid address");
        _revokeRole(KEEPER_ROLE, keeper);

        emit RevokeKeeperRole(keeper);
    }

    // Fetch the equivalent value of either specified BTRFLY/ETH amount
    function calculateAmountRequiredForLP(uint256 amount, bool isBTRFLY)
        private
        view
        returns (uint256)
    {
        // Default price is based off "1 BTRFLY = X ETH", in 10^18 format
        uint256 priceOracle = ICurveCryptoPool(CURVEPOOL).price_oracle();
        uint256 baseExp = 10**18;
        uint256 ethExp = 10**_ethDecimals;
        uint256 btrflyExp = 10**_btrflyDecimals;

        require(priceOracle > 0, "Invalid price oracle");

        if (isBTRFLY) {
            return (((amount * priceOracle) / baseExp) * ethExp) / btrflyExp;
        }

        return (((amount * baseExp) / priceOracle) * btrflyExp) / ethExp;
    }

    // Return the currently available ETH and BTRFLY amounts
    function getAvailableLiquidity()
        private
        view
        returns (
            uint256 ethLiquidity,
            uint256 btrflyLiquidity
        )
    {
        uint256 btrfly = IBTRFLY(BTRFLY).balanceOf(address(this));
        uint256 ethAmount = calculateAmountRequiredForLP(btrfly, true);
        uint256 ethCap = IERC20(WETH).balanceOf(TREASURY);
        ethLiquidity = ethCap > ethAmount ? ethAmount : ethCap;

        // Use BTRFLY balance if remaining capacity is enough, otherwise, calculate BTRFLY amount
        btrflyLiquidity = ethCap > ethAmount
            ? btrfly
            : calculateAmountRequiredForLP(ethLiquidity, false);
    }

    // Return the minimum expected LP token amount based on the currently available liquidity
    // which is used by the off-chain process to decide whether to perform upKeep or not
    function getMinimumLPAmount()
        external
        view
        returns (uint256)
    {
        uint256 ethLiquidity;
        uint256 btrflyLiquidity;
        (ethLiquidity, btrflyLiquidity) = getAvailableLiquidity();

        if (ethLiquidity != 0 && btrflyLiquidity != 0) {
            uint256[2] memory amounts = [ethLiquidity, btrflyLiquidity];
            return ICurveCryptoPool(CURVEPOOL).calc_token_amount(
                amounts
            );
        }

        // Default to 0 if either ETH or BTRFLY amount is insufficient and upKeep shouldn't be performed
        return 0;
    }

    // Perform the actual upkeep flow based on the specified liquidity and expected LP amounts
    function performUpkeep(uint256 minimumLPAmount) external onlyRole(KEEPER_ROLE) {
        uint256 ethLiquidity;
        uint256 btrflyLiquidity;
        (ethLiquidity, btrflyLiquidity) = getAvailableLiquidity();

        require(
            ethLiquidity != 0 && btrflyLiquidity != 0,
            "Insufficient amounts"
        );
        require(minimumLPAmount != 0, "Invalid slippage");

        // Obtain WETH from the treasury
        IRedactedTreasury(TREASURY).manage(WETH, ethLiquidity);

        // Attempt to add liquidity with the specified amounts and minimum LP token to be received
        uint256[2] memory amounts = [ethLiquidity, btrflyLiquidity];
        ICurveCryptoPool(CURVEPOOL).add_liquidity(amounts, minimumLPAmount);

        // Transfer out the pool token to treasury
        address token = ICurveCryptoPool(CURVEPOOL).token();
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(TREASURY, tokenBalance);

        // Burn any excess/unused BTRFLY
        uint256 unusedBTRFLY = IBTRFLY(BTRFLY).balanceOf(address(this));
        if (unusedBTRFLY != 0) {
            IBTRFLY(BTRFLY).burn(unusedBTRFLY);
        }

        emit AddLiquidity(ethLiquidity, btrflyLiquidity, unusedBTRFLY);
    }

    // Withdraw arbitrary token and amount owned by the contract
    function withdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(token != address(0), "Invalid token");
        require(recipient != address(0), "Invalid recipient");
        require(amount != 0, "Invalid amount");

        IERC20(token).safeTransfer(recipient, amount);

        emit Withdraw(token, amount, recipient);
    }
}
