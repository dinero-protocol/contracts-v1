// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IBTRFLY is IERC20 {
    function burn(uint256 amount) external;
}

interface IRedactedTreasury {
    function manage(address _token, uint256 _amount) external;
}

interface ICurveCryptoPool {
    
    function add_liquidity(
        uint256[2] amounts,
        uint256 min_mint_amount 
    ) external payable;

    function calc_token_amount(
         uint256[2] amounts
    ) external view returns (uint256);

}

contract ThecosomataETH {

    address public immutable BTRFLY;
    address public immutable CURVEPOOL;
    address public immutable TREASURY;

    event AddLiquidity(
        uint256 ethLiquidity,
        uint256 btrflyLiquidity,
        uint256 btrflyBurned
    );

    constructor(
        address _BTRFLY,
        address _TREASURY,
        address _CURVEPOOL,
    ) {
        require(_BTRFLY != address(0));
        BTRFLY = _BTRFLY;

        require(_CURVEPOOL != address(0));
        sushiFactory = _sushiFactory;

        require(_TREASURY != address(0));
        TREASURY = _TREASURY;

        IBTRFLY(_BTRFLY).approve(_CURVEPOOL, 2**256 - 1);
    }

    function checkUpkeep(bytes calldata checkData)
        external
        view
        returns (bool upkeepNeeded)
    {
        if (IBTRFLY(BTRFLY).balanceOf(address(this)) > 0) {
            return true;
        }
    }

    function calculateAmountRequiredForLP(
        uint256 tokenAAmount,
        bool tokenAIsBTRFLY
    ) internal view returns (uint256) {
        // write logic here pls
    }

    function addLiquidity(
        uint256 ethAmount,
        uint256 btrflyAmount
    ) internal {
        // use calc_token_amount
        // use add_liquidity
    }

    function performUpkeep() internal {
        uint256 btrfly = IBTRFLY(BTRFLY).balanceOf(address(this));

        uint256 ethAmount = calculateAmountRequiredForLP(btrfly, true);

        uint256 ethCap = address(this).balance;

        uint256 ethLiquidity = ethCap > ethAmount ? ethAmount : ethCap;

        // Use BTRFLY balance if remaining capacity is enough, otherwise, calculate BTRFLY amount
        uint256 btrflyLiquidity = ethCap > ethAmount
            ? btrfly 
            : calculateAmountRequiredForLP(ethLiquidity, false);

        addLiquidity(ethLiquidity, btrflyLiquidity);

        uint256 unusedBTRFLY = IBTRFLY(BTRFLY).balanceOf(address(this));

        if (unusedBTRFLY > 0) {
            IBTRFLY(BTRFLY).burn(unusedBTRFLY);
        }

        emit AddLiquidity(
            // insert vars pls
        )

    }

    function withdraw(
        address token,
        uint256 amount,
        address recipient
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        IERC20(token).transfer(recipient, amount);
    }

    function withdrawETH(
        uint256 amount,
        address payable recipient
    ) external onlyOwner {
        require(recipient != address(0), "Invalid recipient");
        recipient.transfer(amount);
    }

}