// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

interface ILockToken{

    //event DelegateVotes(address indexed from, address indexed to);

    event MintLock(address indexed payer, address indexed to, uint indexed lockId, uint amount);

    //amount is indexed so we can query specifically for extensions;
    event ExpandLock(uint indexed nftId, uint indexed amount);

    event BreakLock(address indexed keeper, uint indexed nftId);

    event MergeLock(address indexed to, uint indexed newNftId, uint[] nftIds);

    event SplitLock(address indexed to, uint indexed oldNftId, uint[] nftIds);

    //balance change event
    event BalTimeTransfer(address indexed from, address indexed to, uint amount);
    event LockAmountTransfer(address indexed from, address indexed to, uint amount);

    // ---

    struct Snapshots {
        uint[] ids;
        uint[] values;
    }

    struct NFTInfo{
        uint lockId;
        uint expiry;
        uint balTime;
        uint lockAmount;
    }

    struct LockInfo{
        uint lockDuration;
        string name;
        bool enabled;
    }

    //view functions

    function getTotalLocked() external view returns (uint totalLocked);
    function getTotalLockedAt(uint snapshotId) external view returns (uint totalLocked);

    function getTotalBalTime() external view returns (uint totalBalTime);
    function getTotalBalTimeAt(uint snapshotId) external view returns (uint totalBalTime);

    function getTotalConviction() external view returns (uint totalConviction);
    function getTotalConvictionAt(uint snapshotId) external view returns (uint totalConviction);

    function getTotalUserLocked(address user) external view returns (uint totalUserLocked);
    function getTotalUserLockedAt(address user, uint snapshotId) external view returns (uint totalUserLocked);

    function getUserLockedByLockId(address user, uint lockId) external view returns (uint userLockedByLockId);
    function getUserLockedByLockIdAt(address user, uint lockId, uint snapshotId) external view returns (uint userLockedByLockId);

    function getTotalUserBalTime(address user) external view returns (uint totalUserBalTime);
    function getTotalUserBalTimeAt(address user, uint snapshotId) external view returns (uint totalUserBalTime);

    function getTotalUserConviction(address user) external view returns (uint totalUserConviction);
    function getTotalUserConvictionAt(address user, uint snapshotId) external view returns (uint totalUserConviction);

    //function getUserDelegate(address user) external view returns (address delegate);

    function getNFTInfo(uint id) external view returns (NFTInfo memory nftInfo);

    function getNFTConviction(uint id) external view returns (uint nftConviction);

    function getLockInfo(uint id) external view returns (LockInfo memory lockInfo);

    //admin functions

    function setKeeperRewardBP(uint keeperRewardBP_) external;

    function setTokenURIRoot(string memory root) external;

    function setLockStatus(uint lockId, bool enable) external;

    function createNewLock(LockInfo memory newLock) external;

    function migrateVault(address vault_) external;

    //special functions

    function mintLock(uint lockId, uint amount) external returns(uint nftId);
    function mintLock(uint lockId, uint amount, address to) external returns(uint nftId);

    function expandLock(uint nftId, uint amount) external;

    function extendLock(uint nftId) external;

    function breakLock(uint nftId, address keeper) external;

    function mergeLock(uint[] calldata nftIds) external returns (uint nftId);
    //function mergeLock(uint[] calldata nftIds, address to) external returns (uint nftId);

    function splitLock(uint[] calldata basisPoints, uint nftId) external returns (uint[] memory nftIds);

    //function delegateVotes(address delegate) external;

    //function batchTransferFrom(uint[] calldata ids) external;

    //function safeBatchTransferFrom(uint[] calldata ids) external;

    //function safeBatchTransferFrom(uint[] calldata ids, bytes[] memory data) external;

}
