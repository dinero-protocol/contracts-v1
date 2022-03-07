// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

// vote delegation
// - delegate NFT power to a single address
// - view NFT delegate

// transfer hooks
// - calculate holder net balance
// - update snapshot

// mint locks

// get NFT info

// redeem locks
// - id

// extend lock (keep lock)
// - id

// extend lock (overload to change lock type)
// - id
// - newLockType

// merge locks

// split locks

// userTotalConviction

// userTotalBalance

interface ILockToken{

    //vote delegation event
    //lock redemption event
    //lock extension event
    //merge lock event
    //split lock event
    //mint lock event
    //switch lock event
    //balance change event

    // ---

    struct NFTInfo{
        uint lockId;
        uint expiry;
        uint netLockTime;
        uint lockAmount;
    }

    struct LockInfo{
        uint lockDuration;
        string name;
        bool enabled;
    }

    //view functions

    function totalUserLockedBalance(address user) external view returns (uint totalUserLocked);

    function userLockedBalanceByLockId(address user, uint lockId) external returns (uint userLockedByLockId);

    function totalUserConviction(adddress user) external view returns (uint userConviction);

    function totalLockedBalance() external view returns (uint totalLocked);

    function totalProtocolConviction() external view returns (uint totalConviction);

    function getNFTInfo(uint id) external view returns (NFTInfo nftInfo);

    //admin functions

    function setTokenURIRoot(string memory root) external;

    function setLockStatus(uint lockId, bool enable) external;

    function createNewLock(LockInfo newLock) external;

    //special functions

    function mintLock(uint lockId, uint amount, address recipient) external;

    function extendLock(uint id) external;

    function redeemLock(uint id) external;

    function switchLockType(uint id) external;

    function merge(uint[] ids) external;

    function split(uint[] basisPoints, uint id) external;

    function batchTransferFrom(uint[] ids) external;

    function safeBatchTransferFrom(uint[] ids) external;

    function safeBatchTransferFrom(uint[] ids, bytes[] memory data) external;

}
