// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IERC20Extended is IERC20 {
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

    function price_oracle() external view returns (uint256);

    function token() external view returns (address);
}

contract ThecosomataETH is AccessControl {
    using SafeERC20 for IERC20;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    address public immutable BTRFLY;
    address public immutable WETH;
    address public immutable CURVEPOOL;
    address public immutable TREASURY;

    uint256 private immutable _btrflyDecimals;
    uint256 private immutable _wethDecimals;

    uint256 public slippage = 5; // in 1000th

    event AddLiquidity(
        uint256 wethLiquidity,
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
    event SetSlippage(uint256 slippage);

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

        _btrflyDecimals = IERC20Extended(_BTRFLY).decimals();
        _wethDecimals = IERC20Extended(_WETH).decimals();

         _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // Update slippage percentage (in 1000th)
    function setSlippage(uint256 _slippage)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        // Make sure the slippage is not > 5%
        require(_slippage <= 50, "Slippage too high");
        slippage = _slippage;

        emit SetSlippage(_slippage);
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

    // Fetch the equivalent value of either specified BTRFLY/WETH amount
    function _calculateAmountRequiredForLP(uint256 amount, bool isBTRFLY)
        private
        view
        returns (uint256)
    {
        // Default price is based off "1 BTRFLY = X WETH", in 10^18 format
        uint256 priceOracle = ICurveCryptoPool(CURVEPOOL).price_oracle();
        uint256 baseExp = 10**18;
        uint256 wethExp = 10**_wethDecimals;
        uint256 btrflyExp = 10**_btrflyDecimals;

        require(priceOracle != 0, "Invalid price oracle");

        if (isBTRFLY) {
            return (((amount * priceOracle) / baseExp) * wethExp) / btrflyExp;
        }

        return (((amount * baseExp) / priceOracle) * btrflyExp) / wethExp;
    }

    // Return the currently available WETH and BTRFLY amounts
    function _getAvailableLiquidity()
        private
        view
        returns (
            uint256 wethLiquidity,
            uint256 btrflyLiquidity
        )
    {
        uint256 btrfly = IERC20Extended(BTRFLY).balanceOf(address(this));
        uint256 wethAmount = _calculateAmountRequiredForLP(btrfly, true);
        uint256 wethCap = IERC20(WETH).balanceOf(TREASURY);
        wethLiquidity = wethCap > wethAmount ? wethAmount : wethCap;

        // Use BTRFLY balance if remaining capacity is enough, otherwise, calculate BTRFLY amount
        btrflyLiquidity = wethCap > wethAmount
            ? btrfly
            : _calculateAmountRequiredForLP(wethLiquidity, false);
    }

    // Perform the actual upkeep flow based on the available liquidity and expected LP token amounts
    function performUpkeep() external onlyRole(KEEPER_ROLE) {
        uint256 wethLiquidity;
        uint256 btrflyLiquidity;
        (wethLiquidity, btrflyLiquidity) = _getAvailableLiquidity();

        require(
            wethLiquidity != 0 && btrflyLiquidity != 0,
            "Insufficient amounts"
        );

        // Calculate the minimum amount of lp token expected using the specified amounts
        uint256[2] memory amounts = [wethLiquidity, btrflyLiquidity];
        uint256 minimumLPAmount = ICurveCryptoPool(CURVEPOOL).calc_token_amount(
            amounts
        );
        minimumLPAmount -= ((minimumLPAmount * slippage) / 1000);
        require(minimumLPAmount != 0, "Invalid slippage");

        // Obtain WETH from the treasury
        IRedactedTreasury(TREASURY).manage(WETH, wethLiquidity);

        // Attempt to add liquidity with the specified amounts and minimum LP token to be received
        ICurveCryptoPool(CURVEPOOL).add_liquidity(amounts, minimumLPAmount);

        // Transfer out the pool token to treasury
        address token = ICurveCryptoPool(CURVEPOOL).token();
        uint256 tokenBalance = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransfer(TREASURY, tokenBalance);

        // Burn any excess/unused BTRFLY
        uint256 unusedBTRFLY = IERC20Extended(BTRFLY).balanceOf(address(this));
        if (unusedBTRFLY != 0) {
            IERC20Extended(BTRFLY).burn(unusedBTRFLY);
        }

        emit AddLiquidity(wethLiquidity, btrflyLiquidity, unusedBTRFLY);
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
