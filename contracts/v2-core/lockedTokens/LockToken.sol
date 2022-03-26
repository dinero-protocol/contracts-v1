// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

import "@rari-capital/solmate/src/tokens/ERC721.sol";
import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/auth/Auth.sol";

import "@openzeppelin/contracts/utils/Arrays.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/ILockToken.sol";
import "./interfaces/ILockVault.sol";

contract LockToken is ILockToken, ERC721, Auth{

    using Arrays for uint256[];

    // storage of collateral in vault
    ILockVault public vault;
    ERC20 public btrfly;

    //snapshot interval set at 1 week
    uint constant SNAPSHOT_INTERVAL = 7 * 86400;

    uint public lockTypeCount;
    uint public nftIndex;
    uint public keeperRewardBP;

    uint internal _totalLocked;
    Snapshots internal _totalLockedSnapshots;

    uint internal _totalBalTime;
    Snapshots internal _totalBalTimeSnapshots;

    mapping(uint => NFTInfo)  internal _nftInfos;
    mapping(uint => LockInfo) internal _lockInfos;
    mapping(uint => uint) public lockUpdatedAt;

    mapping(address => uint) internal _totalUserLocked;
    mapping(address => Snapshots) internal _totalUserLockedSnapshots;

    mapping(uint => mapping(address => uint)) internal _lockTypeUserLocked;
    mapping(uint => mapping(address => Snapshots)) internal _lockTypeUserLockedSnapshots;

    mapping(address => uint) internal _totalUserBalTime;
    mapping(address => Snapshots) internal _totalUserBalTimeSnapshots;

    mapping(address => address) internal _userDelegate;

    string public rootURL;

    constructor(
        address owner_,
        address authority_,
        address vault_,
        address btrfly_,
        string memory rootURL_,
        uint keeperRewardBP_
    )
    Auth(owner_,Authority(authority_)) 
    ERC721("LockedBTRFLY","LBTRFLY"){
        vault = ILockVault(vault_);
        btrfly = ERC20(btrfly_);
        rootURL = rootURL_;
        keeperRewardBP = keeperRewardBP_;
    }

    function getTotalLocked() external override view returns (uint totalLocked){
        totalLocked = _totalLocked;
    }

    function getTotalLockedAt(uint snapshotId) external view override returns (uint totalLocked){
        (bool snapshotted, uint value) = _valueAt(snapshotId, _totalLockedSnapshots);
        totalLocked = snapshotted ? value : _totalLocked;
    }

    function getTotalBalTime() external override view returns (uint totalBalTime){
        totalBalTime = _totalBalTime;
    }

    function getTotalBalTimeAt(uint snapshotId) external override view returns (uint totalBalTime){
        (bool snapshotted, uint value) = _valueAt(snapshotId, _totalBalTimeSnapshots);
        totalBalTime = snapshotted ? value : _totalBalTime;
    }

    function getTotalConviction() external override view returns (uint totalConviction){
        totalConviction = (_totalLocked * block.timestamp) - _totalBalTime;
    }

    function getTotalConvictionAt(uint snapshotId) external override view returns (uint totalConviction){
        (bool balTimeSnapshotted, uint balTimeValue) = _valueAt(snapshotId, _totalBalTimeSnapshots);
        uint totalBalTime = balTimeSnapshotted ? balTimeValue : _totalBalTime;

        (bool totalLockedSnapshotted, uint totalLockedValue) = _valueAt(snapshotId, _totalLockedSnapshots);
        uint totalLocked = totalLockedSnapshotted ? totalLockedValue : _totalLocked;

        totalConviction = (totalLocked * snapshotId) - totalBalTime;
    }

    function getTotalUserLocked(address user) external override view returns (uint totalUserLocked){
        totalUserLocked = _totalUserLocked[user];
    }

    function getTotalUserLockedAt(address user, uint snapshotId) external override view returns (uint totalUserLocked){
        (bool snapshotted, uint value) = _valueAt(snapshotId, _totalUserLockedSnapshots[user]);
        totalUserLocked = snapshotted ? value : _totalUserLocked[user];
    }

    function getUserLockedByLockId(address user, uint lockId) external override view returns (uint userLockedByLockId){
        userLockedByLockId = _lockTypeUserLocked[lockId][user];
    }

    function getUserLockedByLockIdAt(address user, uint lockId, uint snapshotId) external override view returns (uint userLockedByLockId){
        (bool snapshotted, uint value) = _valueAt(snapshotId, _lockTypeUserLockedSnapshots[lockId][user]);
        userLockedByLockId = snapshotted ? value : _lockTypeUserLocked[lockId][user];
    }

    function getTotalUserBalTime(address user) external override view returns (uint totalUserBalTime){
        totalUserBalTime = _totalUserBalTime[user];
    }

    function getTotalUserBalTimeAt(address user, uint snapshotId) external override view returns (uint totalUserBalTime){
        (bool snapshotted, uint value) = _valueAt(snapshotId, _totalUserBalTimeSnapshots[user]);
        totalUserBalTime = snapshotted ? value : _totalUserBalTime[user];
    }

    function getTotalUserConviction(address user) external override view returns (uint totalUserConviction){
        totalUserConviction = (block.timestamp * _totalUserLocked[user]) - _totalUserBalTime[user];
    }

    function getTotalUserConvictionAt(address user, uint snapshotId) external override view returns (uint totalUserConviction){
        (bool totalUserBalTimeSnapshotted, uint totalUserBalTimeValue) = _valueAt(snapshotId, _totalUserBalTimeSnapshots[user]);
        uint totalUserBalTime = totalUserBalTimeSnapshotted ? totalUserBalTimeValue : _totalUserBalTime[user];

        (bool totalUserLockedSnapshotted, uint totalUserLockedValue) = _valueAt(snapshotId, _totalUserLockedSnapshots[user]);
        uint totalUserLocked = totalUserLockedSnapshotted ? totalUserLockedValue : _totalUserLocked[user];
        
        totalUserConviction = (totalUserLocked * snapshotId) - totalUserBalTime;
    }

    function getUserDelegate(address user) external view override returns(address delegate){
        delegate = _userDelegate[user];
    }

    function getNFTInfo(uint id) external override view returns (NFTInfo memory nftInfo){
        nftInfo = _nftInfos[id];
    }

    function tokenURI(uint256 id) public view virtual override returns (string memory){
        return string(abi.encodePacked(rootURL,Strings.toString(id)));
    }

    function getNFTConviction(uint id) external override view returns (uint nftConviction){
        NFTInfo memory nftInfo = _nftInfos[id];
        nftConviction = ( block.timestamp * nftInfo.lockAmount) - nftInfo.balTime;
    }

    function getLockInfo(uint id) external override view returns (LockInfo memory lockInfo){
        lockInfo = _lockInfos[id];
    }

    // === ADMIN ===

    function setKeeperRewardBP(uint keeperRewardBP_) external override requiresAuth{
        keeperRewardBP = keeperRewardBP_;
    }

    function setTokenURIRoot(string memory rootURL_) external override requiresAuth {
        rootURL = rootURL_;
    }

    function toggleLockStatus(uint lockId) external override requiresAuth {
        LockInfo storage lockToUpdate = _lockInfos[lockId];
        lockToUpdate.enabled = !lockToUpdate.enabled;
        emit ToggleLockStatus(lockId,lockToUpdate.enabled);
    }

    function createNewLock(LockInfo memory newLock) external override requiresAuth {
        uint lockId = lockTypeCount;
        _lockInfos[lockId] = newLock;
        lockUpdatedAt[lockId] = block.timestamp;
        lockTypeCount++;
    }

    function migrateVault(address vault_) external override requiresAuth{
        vault = ILockVault(vault_);
    }

    // === LOCK MANAGEMENT ===

    function _mintLock(uint lockId, uint amount, address to, bool autoRenew) internal returns(uint nftId){

        // check lock is enabled by policy
        require(_lockInfos[lockId].enabled,"LockedBTRFLY : Requested lock is not enabled");

        // call Vault to move funds
        btrfly.transferFrom(msg.sender,address(this),amount);
        vault.deposit(amount);

        _updateAccountSnapshot(to);
        _updateProtocolSnapshot();

        // mint NFT to recipient
        nftId = nftIndex;
        nftIndex++;

        uint balTime = block.timestamp * amount;

        _mint(to,nftId);
        // set NFT variables
        _nftInfos[nftId] = NFTInfo(
            lockId,
            block.timestamp + _lockInfos[lockId].lockDuration,
            balTime,
            amount,
            autoRenew
        );

        // update balances and conviction
        _totalLocked += amount;
        _totalUserLocked[to] += amount;

        _totalBalTime += balTime;
        _totalUserBalTime[to] += balTime;

        emit MintLock(msg.sender,to,lockId,amount);
        emit BalTimeTransfer(address(0),to,balTime);
        emit LockAmountTransfer(address(0),to,amount);
    }

    function mintLock(uint lockId, uint amount, bool autoRenew) external override returns(uint nftId){
        nftId = _mintLock(lockId, amount, msg.sender, autoRenew);
    }

    function mintLock(uint lockId, uint amount, address to, bool autoRenew) external override returns(uint nftId){
        nftId = _mintLock(lockId, amount, to, autoRenew);
    }

    function _expandLock(uint nftId, uint amount) internal {

        // verify caller is authorised to expand lock
        address nftOwner = ownerOf[nftId];

        require(
            msg.sender == nftOwner || msg.sender == getApproved[nftId] || isApprovedForAll[nftOwner][msg.sender],
            "LockedBTRFLY : NOT_AUTHORIZED"
        );

        NFTInfo storage nftInfo = _nftInfos[nftId];
        
        require(_lockInfos[nftInfo.lockId].enabled,"LockedBTRFLY : NFT's lock type is not enabled");

        if (!nftInfo.autoRenew) require(nftInfo.expiry > block.timestamp, "LockedBTRFLY : NFT has expired");
            else if (nftInfo.autoRenew && !_lockInfos[nftInfo.lockId].enabled){
                require(
                    lockUpdatedAt[nftInfo.lockId] + _lockInfos[nftInfo.lockId].lockDuration > block.timestamp,
                    "LockedBTRFLY : NFT has expired"
                );
            }

        // call Vault to move funds
        btrfly.transferFrom(msg.sender,address(this),amount);
        vault.deposit(amount);

        _updateAccountSnapshot(nftOwner);
        _updateProtocolSnapshot();

        uint balTime = block.timestamp * amount;

        nftInfo.lockAmount += amount;
        nftInfo.balTime += balTime;
        nftInfo.expiry = block.timestamp + _lockInfos[nftInfo.lockId].lockDuration;

        if(amount > 0){
            // update balances and conviction
            _totalLocked += amount;
            _totalUserLocked[nftOwner] += amount;

            _totalBalTime += balTime;
            _totalUserBalTime[nftOwner] += balTime;
        }

        emit ExpandLock(nftId,amount);
    }

    function expandLock(uint nftId, uint amount) external override{
        _expandLock(nftId, amount);
    }

    function extendLock(uint nftId) external override{
        _expandLock(nftId, 0);
    }

    function _mergeLock(uint[] calldata nftIds, bool autoRenew) internal returns(uint nftId){

        address to = ownerOf[nftIds[0]];

        require(
            msg.sender == to || msg.sender == getApproved[nftIds[0]] || isApprovedForAll[to][msg.sender],
            "LockedBTRFLY : NOT_AUTHORIZED"
        );

        NFTInfo memory nftInfo = _nftInfos[nftIds[0]];
        uint balTime = nftInfo.balTime;
        uint lockAmount = nftInfo.lockAmount;
        uint latestExpiry = nftInfo.expiry;
        uint lockId = nftInfo.lockId;
        
        _burn(nftIds[0]);
        delete _nftInfos[nftIds[0]];

        for(uint i=1; i < nftIds.length; i++){

            require(to == ownerOf[nftIds[i]], "LockedBTRFLY : Merge failed due to NFTs having different owners");

            require(
                msg.sender == to || msg.sender == getApproved[nftIds[i]] || isApprovedForAll[to][msg.sender],
                "LockedBTRFLY : NOT_AUTHORIZED"
            );
            
            nftInfo = _nftInfos[nftIds[i]];

            require(lockId == nftInfo.lockId, "LockedBTRFLY : Merge failed due to NFTs having lockTypes");

            if (!nftInfo.autoRenew) require(nftInfo.expiry > block.timestamp, "LockedBTRFLY : NFT has expired");
            else if (nftInfo.autoRenew && !_lockInfos[nftInfo.lockId].enabled){
                require(
                    lockUpdatedAt[nftInfo.lockId] + _lockInfos[nftInfo.lockId].lockDuration > block.timestamp,
                    "LockedBTRFLY : NFT has expired"
                );
            }

            uint nftExpiry = nftInfo.expiry;

            if(nftInfo.autoRenew && nftExpiry < block.timestamp ){

                nftExpiry = 
                    ((((block.timestamp - nftExpiry) / _lockInfos[lockId].lockDuration) + 1)
                    * _lockInfos[lockId].lockDuration) + nftExpiry;

            }

            balTime += nftInfo.balTime;
            lockAmount += nftInfo.lockAmount;

            if (nftExpiry > latestExpiry) latestExpiry = nftInfo.expiry;

            _burn(nftIds[i]);
            delete _nftInfos[nftIds[i]];

        }

        nftId = nftIndex;
        nftIndex++;

        _mint(to,nftId);
        // set NFT variables
        _nftInfos[nftId] = NFTInfo(
            lockId,
            latestExpiry,
            balTime,
            lockAmount,
            autoRenew
        );

        emit MergeLock(to,nftId,nftIds);

    }

    function mergeLock(uint[] calldata nftIds, bool autoRenew) external override returns(uint nftId){
        nftId = _mergeLock(nftIds, autoRenew);
    }

    // split
    function _splitLock(uint[] calldata basisPoints ,uint nftId) internal returns(uint[] memory nftIds){
        nftIds = new uint[](basisPoints.length);
        NFTInfo memory nftInfo = _nftInfos[nftId];

        address to = ownerOf[nftId];

        require(
            msg.sender == to || msg.sender == getApproved[nftId] || isApprovedForAll[to][msg.sender],
            "LockedBTRFLY : NOT_AUTHORIZED"
        );

        uint balTime = nftInfo.balTime;
        uint lockAmount = nftInfo.lockAmount;
        uint expiry = nftInfo.expiry;
        uint lockId = nftInfo.lockId;
        bool autoRenew = nftInfo.autoRenew;

        // verify that lock is not expired
        if (!nftInfo.autoRenew) require(nftInfo.expiry > block.timestamp, "LockedBTRFLY : NFT has expired");
        else if (nftInfo.autoRenew && !_lockInfos[nftInfo.lockId].enabled){
            require(
                lockUpdatedAt[nftInfo.lockId] + _lockInfos[nftInfo.lockId].lockDuration > block.timestamp,
                "LockedBTRFLY : NFT has expired"
            );
        }

        _burn(nftId);
        delete _nftInfos[nftId];

        uint bpSum = 0;

        for(uint i=0; i < basisPoints.length; i++){
            bpSum += basisPoints[i];
            nftIds[i] = nftIndex;
            nftIndex++;

            _mint(to,nftId);
            // set NFT variables
            _nftInfos[nftId] = NFTInfo(
                lockId,
                expiry,
                balTime*basisPoints[i]/10000,
                lockAmount*basisPoints[i]/10000,
                autoRenew
            );
        }

        require(bpSum == 10000, "LockedBTRFLY : sum of basis points must be 10000");

        emit SplitLock(to,nftId,nftIds);

    }

    function splitLock(uint[] calldata basisPoints ,uint nftId) external override returns(uint[] memory nftIds){
        nftIds = _splitLock(basisPoints,nftId);
    }

    function _toggleAutoRenew(uint nftId) internal{

        NFTInfo storage nftInfo = _nftInfos[nftId];

        // verify that lock is expired
        if (!nftInfo.autoRenew) require(nftInfo.expiry > block.timestamp, "LockedBTRFLY : NFT has expired");
        else if (nftInfo.autoRenew && !_lockInfos[nftInfo.lockId].enabled){
            require(
                lockUpdatedAt[nftInfo.lockId] + _lockInfos[nftInfo.lockId].lockDuration > block.timestamp,
                "LockedBTRFLY : NFT has expired"
            );
        }

        address to = ownerOf[nftId];

        require(
            msg.sender == to || msg.sender == getApproved[nftId] || isApprovedForAll[to][msg.sender],
            "LockedBTRFLY : NOT_AUTHORIZED"
        );

        nftInfo.autoRenew = !nftInfo.autoRenew;

        emit ToggleAutoRenew(nftId,nftInfo.autoRenew);

    }

    function toggleAutoRenew(uint nftId) external override{
         _toggleAutoRenew(nftId);
    }

    function _breakLock(uint nftId, address keeper) internal{

        NFTInfo memory nftInfo = _nftInfos[nftId];
        address nftOwner = ownerOf[nftId];

        uint amount = nftInfo.lockAmount;
        uint balTime = nftInfo.balTime;

        // verify that lock is expired
        if (!nftInfo.autoRenew) require(nftInfo.expiry < block.timestamp, "LockedBTRFLY : NFT has not expired");
        else if (nftInfo.autoRenew && !_lockInfos[nftInfo.lockId].enabled){
            require(
                lockUpdatedAt[nftInfo.lockId] + _lockInfos[nftInfo.lockId].lockDuration < block.timestamp,
                "LockedBTRFLY : NFT has not expired"
            );
        }
        else revert("LockedBTRFLY : NFT has not expired");

        // update balances and conviction
        _totalLocked -= amount;
        _totalUserLocked[nftOwner] -= amount;

        _totalBalTime -= balTime;
        _totalUserBalTime[nftOwner] -= balTime;

        _burn(nftId);
        delete _nftInfos[nftId];

        vault.withdraw(amount);

        if( nftOwner == keeper ) btrfly.transfer(nftOwner, amount);
        else{
            btrfly.transfer(nftOwner, amount * (10000 - keeperRewardBP)/10000);
            btrfly.transfer(keeper, amount * keeperRewardBP/ 10000 );
        }

        emit BreakLock(keeper,nftId);

        emit LockAmountTransfer(nftOwner, address(0), amount);
        emit BalTimeTransfer(nftOwner, address(0), balTime);

    }

    function breakLock(uint nftId, address keeper) external override{
        _breakLock(nftId,keeper);
    }

    function switchLockType(uint nftId, uint lockId) external override{

        require(_lockInfos[lockId].enabled,"LockedBTRFLY : Requested lock is not enabled");

        address to = ownerOf[nftId];

        require(
            msg.sender == to || msg.sender == getApproved[nftId] || isApprovedForAll[to][msg.sender],
            "LockedBTRFLY : NOT_AUTHORIZED"
        );

        NFTInfo storage nftInfo = _nftInfos[nftId];
        nftInfo.lockId = lockId;
        nftInfo.expiry = block.timestamp + _lockInfos[lockId].lockDuration;

        emit SwitchLockType(nftId, lockId);

    }

    // transferFrom
    function transferFrom(address from, address to, uint256 id) public virtual override{
        NFTInfo memory nftInfo = _nftInfos[id];
        //verify that lock is not expired
        require(nftInfo.expiry > block.timestamp, "LockedBTRFLY : NFT has expired");
        //update snapshots of sender and receiver
        _updateAccountSnapshot(from);
        _updateAccountSnapshot(to);
        //subtract lockedAmount + balTime from from
        _totalUserLocked[from] -= nftInfo.lockAmount;
        _totalUserBalTime[from] -= nftInfo.balTime;
        //super
        super.transferFrom(from,to,id);
        //add lockedAmount + balTime to do
        _totalUserLocked[to] += nftInfo.lockAmount;
        _totalUserBalTime[to] += nftInfo.balTime;
        emit BalTimeTransfer(from,to,nftInfo.balTime);
        emit LockAmountTransfer(from,to,nftInfo.lockAmount);
    }

    // safeTransferFrom
    function safeTransferFrom(
        address from,
        address to,
        uint256 id
    ) public virtual override{
        transferFrom(from, to, id);

        require(
            to.code.length == 0 ||
                ERC721TokenReceiver(to).onERC721Received(msg.sender, from, id, "") ==
                ERC721TokenReceiver.onERC721Received.selector,
            "UNSAFE_RECIPIENT"
        );
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 id,
        bytes memory data
    ) public virtual override{
        transferFrom(from, to, id);

        require(
            to.code.length == 0 ||
                ERC721TokenReceiver(to).onERC721Received(msg.sender, from, id, data) ==
                ERC721TokenReceiver.onERC721Received.selector,
            "UNSAFE_RECIPIENT"
        );
    }

    function delegateVote(address delegate) external override{
        _userDelegate[msg.sender] = delegate;
        emit DelegateVote(msg.sender,delegate);
    }

    function _updateAccountSnapshot(address user) internal{
        _updateSnapshot(_totalUserLockedSnapshots[user],_totalUserLocked[user]);
        _updateSnapshot(_totalUserBalTimeSnapshots[user],_totalUserBalTime[user]);
        for(uint i=0; i < lockTypeCount; i++){
            _updateSnapshot(_lockTypeUserLockedSnapshots[i][user],_lockTypeUserLocked[i][user]);
        }
    }

    function _updateProtocolSnapshot() internal{
        _updateSnapshot(_totalLockedSnapshots,_totalLocked);
        _updateSnapshot(_totalBalTimeSnapshots,_totalBalTime);
    }

    function _getCurrentSnapshotId() internal view returns (uint currentSnapshotId){
        currentSnapshotId = ((block.timestamp / SNAPSHOT_INTERVAL) + 1) * SNAPSHOT_INTERVAL ;
    }

    function getSnapshotId() external view override returns (uint currentSnapshotId){
        currentSnapshotId = _getCurrentSnapshotId();
    }

    // function taken from @openzeppelin/contracts/token/ERC20/extensions/ERC20Snapshot.sol
    function _valueAt(uint snapshotId, Snapshots storage snapshots) internal view returns (bool, uint) {
        require(snapshotId > 0, "ERC20Snapshot: id is 0");
        require(snapshotId <= _getCurrentSnapshotId(), "ERC20Snapshot: nonexistent id");

        uint index = snapshots.ids.findUpperBound(snapshotId);

        if (index == snapshots.ids.length) {
            return (false, 0);
        } else {
            return (true, snapshots.values[index]);
        }
    }

    function _updateSnapshot(Snapshots storage snapshots, uint currentValue) internal {
        uint currentId = _getCurrentSnapshotId();
        if (_lastSnapshotId(snapshots.ids) < currentId) {
            snapshots.ids.push(currentId);
            snapshots.values.push(currentValue);
        }
    }

    function _lastSnapshotId(uint[] storage ids) internal view returns (uint) {
        if (ids.length == 0) {
            return 0;
        } else {
            return ids[ids.length - 1];
        }
    }

}


// delegate voting power
// events for deposits, locks etc