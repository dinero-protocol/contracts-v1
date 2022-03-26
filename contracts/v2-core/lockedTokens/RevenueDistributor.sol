// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/auth/Auth.sol";
import "./interfaces/ILockToken.sol";

// revenue distributed every 4 weeks
// claimToken(address token, address recipient, bool conviction, uint minRound, uint maxRound)
// claimTokens(address[] tokens, address recipient, bool[] convictions, uint minRound, uint maxRound)
// claimAll(address recipient, uint minRound, uint maxRound)

// (token,conviction,round) => uint; (amount of rewards)
// (token,conviction,round,user) => bool; (user claimed)

// round => reward[] (address token, bool conviction)

// uint offset = number of weeks to offset by (depends on launch date)

contract RevenueDistributor is Auth{

    event Deposit(bytes32 indexed rewardHash, uint amount);
    // event claim(address indexed user, address indexed recipient, bytes32 indexed rewardHash, uint index round, uint amount)
    // event 

    uint public constant PRECISION = 1e18;

    ILockToken public lockToken;

    struct Reward{
        address token;
        bool conviction;
    }

    struct RewardRound{
        address token;
        bool conviction;
        uint round;
    }

    mapping(bytes32 => uint) internal _rewardRoundAmount;
    mapping(bytes32 => mapping(address => bool)) internal _userClaimedRewardRound;

    mapping(uint => Reward[]) internal _roundRewards;

    uint public offset;

    constructor(
        address owner_,
        address authority_,
        address lockToken_, 
        uint offset_
        )
        Auth(owner_,Authority(authority_)){
            lockToken = ILockToken(lockToken_);
            offset = offset_;
        }

    function _getCurrentRound() internal view returns (uint round){
        round = (block.timestamp + (offset * 1 weeks)) / (4 * 1 weeks);
    }

    function getCurrentRound() external view returns (uint round){
        round = _getCurrentRound();
    }

    function _getTimestampFromRound(uint round) internal view returns (uint timestamp){
        timestamp = ((round * 4) + offset) * 1 weeks;
    }

    function getTimestampFromRound(uint round) external view returns (uint timestamp){
        timestamp = _getTimestampFromRound(round);
    }

    function _getRewardHash(address token, bool conviction) internal view returns(bytes32 rewardHash){
        rewardHash = keccak256(abi.encode(token,conviction));
    }

    function getRewardHash(address token, bool conviction) external view returns(bytes32 rewardHash){
        rewardHash = _getRewardHash(token, conviction);
    }

    function _getUserAmount(
            address user, 
            bool conviction, 
            uint snapshotId
        ) internal view returns(uint userAmount){
            if (conviction) userAmount = lockToken.getTotalUserConvictionAt(user,snapshotId);
            else userAmount = lockToken.getTotalUserLockedAt(user,snapshotId);
            
    }

    function getUserAmount(
            address user, 
            bool conviction, 
            uint snapshotId
    ) external view returns(uint userAmount){
        userAmount = _getUserAmount(user,conviction,snapshotId);
    }

    function _getProtocolAmount(
        bool conviction, 
        uint snapshotId
    ) internal view returns(uint protocolAmount){
        if (conviction) protocolAmount = lockToken.getTotalConvictionAt(snapshotId);
        else protocolAmount = lockToken.getTotalLockedAt(snapshotId);
    }

    function getProtocolAmount(
        bool conviction,
        uint snapshotId
    ) external view returns(uint protocolAmount){
        protocolAmount = _getProtocolAmount(conviction, snapshotId);
    }

    function _getUserSnapshotShare(
            address user, 
            bool conviction, 
            uint snapshotId
        ) internal view returns(uint userShare){
            uint userAmount = _getUserAmount(user, conviction, snapshotId);
            uint protocolAmount = _getProtocolAmount(conviction, snapshotId);
            userShare = userAmount * PRECISION / protocolAmount;
        }

    function getUserSnapshotShare(
            address user, 
            bool conviction, 
            uint snapshotId
        ) external view returns(uint userShare){
            userShare = _getUserSnapshotShare(user, conviction, snapshotId);
        }

    function _getUserRoundShare(
            address user,
            bool conviction,
            uint round
        ) internal view returns(uint userRoundShare){
            uint timestampI = _getTimestampFromRound(round);
            uint sum = 0;
            for(uint i = 0; i < 5; i++){
                sum += _getUserSnapshotShare(user, conviction, timestampI);
                timestampI -= 1 weeks;
            }
            userRoundShare = sum/4;
        }

    function getUserRoundShare(
            address user,
            bool conviction,
            uint round
        ) external view returns(uint userRoundShare){
            userRoundShare = _getUserRoundShare(user,conviction,round);
        }

    function _getRewardRoundHash(
            address token, 
            bool conviction, 
            uint round
        ) internal view returns(bytes32 rewardRoundHash){
            rewardRoundHash = keccak256(abi.encode(token,conviction,round));
        }

    function getRewardRoundHash(
            address rewardToken, 
            bool conviction, 
            uint round
        ) external view returns(bytes32 rewardRoundHash){
            rewardRoundHash = _getRewardRoundHash(rewardToken,conviction,round);
        }


    function deposit(address token, bool conviction, uint amount) external requiresAuth{
        
        uint currentRound = _getCurrentRound();
        bytes32 rewardRound = _getRewardRoundHash(token,conviction,currentRound);

        if(_rewardRoundAmount[rewardRound] == 0) _roundRewards[currentRound].push(
            Reward(
                token,
                conviction
            )
        );

        ERC20(token).transferFrom(msg.sender, address(this), amount);
        _rewardRoundAmount[rewardRound] += amount;

        emit Deposit(_getRewardHash(token,conviction),amount);

    }

    function _claimToken(
            address user, 
            address recipient, 
            address token,
            bool conviction,
            uint round,
            uint userShare
        ) internal{

            bytes32 rewardRoundHash = _getRewardRoundHash(token,conviction,round);
            require(_rewardRoundAmount[rewardRoundHash] > 0, "RevenueDistributor : no reward for token/conviction");
            require(!_userClaimedRewardRound[rewardRoundHash][user], "RevenueDistributor : user already claimed reward for token/conviction");

            bytes32 rewardRound = _getRewardRoundHash(token,conviction,round);

            uint payment = _rewardRoundAmount[rewardRound] * userShare / PRECISION;

            _userClaimedRewardRound[rewardRoundHash][user] = true;

            ERC20(token).transfer(recipient,payment);

            //emit event

        }

    function _claimTokens(
        address recipient,
        Reward[] calldata rewards,
        uint round
    ) internal {

        uint regularShare = _getUserRoundShare(msg.sender,false,round);
        uint convictionShare = _getUserRoundShare(msg.sender,true,round);

        for (uint i = 0; i < rewards.length; i++){
            _claimToken(
                msg.sender, 
                recipient, 
                rewards[i].token, 
                rewards[i].conviction, 
                round, 
                rewards[i].conviction ? convictionShare : regularShare
                );
        }

    }

    function claimTokens(
        address recipient,
        Reward[] calldata rewards,
        uint round
    ) external {
        _claimTokens(recipient, rewards, round);
    }

    function claimTokensBatch(
        address recipient,
        Reward[][] calldata roundRewards,
        uint[] calldata rounds
    ) external {

        for(uint i=0; i < rounds.length; i++){

            _claimTokens(
                recipient,
                roundRewards[i],
                rounds[i]
            );

        }

    }

}