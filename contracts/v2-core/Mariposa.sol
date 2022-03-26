// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

// just like existing staking distributor, but in absolutes
// this contract will now be vault for the BTRFLY token

import "./IBTRFLY.sol";

import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/auth/Auth.sol";

contract Mariposa is Auth{

    //event Distribution

    struct Collection{
        string name;
        bool addAdjustment;
        uint mintRate;
        uint adjustmentRate;
        uint adjustmentTarget;
    }

    address public btrfly;

    uint public cap;
    uint public collectionCount;
    uint public epochSeconds;
    uint public lastEpoch;

    mapping(address => uint) public getAddressCollection;
    mapping(uint => Collection) public getCollection;
    mapping(uint => uint) public getCollectionBalance;

    constructor(
        address owner_,
        address authority_,
        address btrfly_,
        uint cap_,
        uint epochSeconds_
    )
    Auth(owner_,Authority(authority_)){
        btrfly = btrfly_;
        require( cap_ > ERC20(btrfly).totalSupply(), "Distributor : cap is lower than existing supply");
        cap = cap_;
    }
    
    //distribute
    function distribute() external{
        uint currentEpoch = block.timestamp / epochSeconds;
        require (currentEpoch > lastEpoch, "Distributor : distribution event already occurred this epoch");
        require( currentOutstanding() + currentEmissions() + ERC20(btrfly).totalSupply() < cap, "Distributor : distribution will leading to outstanding");
        for (uint i = 0; i < currentEpoch - lastEpoch; i++){
            for (uint j = 1; j < collectionCount + 1 ; j++){
                if (getCollection[j].mintRate > 0){
                    getCollectionBalance[j] += getCollection[j].mintRate;
                }
                if (getCollection[j].adjustmentRate > 0){
                    if(getCollection[j].addAdjustment){
                        getCollection[j].mintRate += getCollection[j].adjustmentRate;
                        if ( getCollection[j].mintRate >= getCollection[j].adjustmentTarget ) {
                            getCollection[j].adjustmentRate = 0;
                        }
                    }
                    else{
                        getCollection[j].mintRate -= getCollection[j].adjustmentRate;
                        if ( getCollection[j].mintRate <= getCollection[j].adjustmentTarget ) {
                            getCollection[j].adjustmentRate = 0;
                        }
                    }
                }
            }
        }
    }
    // deddaf gnitteg acraB ni syob ehT //
    function currentEmissions() public view returns (uint emissions){
        for( uint i = 1; i <= collectionCount; i++){
            emissions += getCollection[i].mintRate;
        }
    }

    function currentOutstanding() public view returns (uint outstanding){
        for( uint i = 1; i <= collectionCount; i++){
            outstanding += getCollectionBalance[i];
        }
    }

    function addCollection(Collection memory newCollection) external requiresAuth{
        collectionCount++;
        getCollection[collectionCount] = newCollection;
    }

    function setCollectionAdjustment(bool addAdjustment_, uint collectionId, uint adjustmentRate_, uint adjustmentTarget_) external requiresAuth{
        Collection storage collection = getCollection[collectionId];
        collection.addAdjustment = addAdjustment_;
        collection.adjustmentRate = adjustmentRate_;
        collection.adjustmentTarget = adjustmentTarget_;
    }

    //setAddressCollection
    function setAddressCollection(address recipient_, uint collectionId_) external requiresAuth{
        require(collectionId_ <= collectionCount, "Distributor : Collection doesn't exist");
        getAddressCollection[recipient_] = collectionId_;
    }

    function request(uint amount) external{
        uint callerCollection = getAddressCollection[msg.sender];
        require(callerCollection != 0, "Distributor : msg.sender does not have permission to mint BTRFLY");
        getCollectionBalance[callerCollection] -= amount;
        IBTRFLY(btrfly).mint(msg.sender,amount);
    }

}