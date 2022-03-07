// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

// import solmate erc721
import "@rari-capital/solmate/src/ERC721.sol";

import "./interfaces/ILockToken.sol";
import "./interfaces/ILockVault.sol";

// storage of collateral in vault
// delegate voting power
// lock types
// nft specific info
// - expiration
// - avgDepositTime
// - depositAmount
// - lockType
// - salt
// contract wide variables
// - cumulative conviction

// snapshots (for conviction staking)
// - linked to users
// - must be updated when balances change!!

// merge NFTs
// - only if lock type and expiration is same
// split NFTs
// - id
// - array with basis point distributions


// events for deposits, locks etc