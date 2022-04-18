//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/interfaces/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./library/BoringMath.sol";
import "./interface/ILocker.sol";

contract Locker is ILocker, ReentrancyGuard, Ownable {
    using BoringMath for uint256;
    using SafeERC20 for IERC20;

    struct Balances {
        uint112 locked;
        uint32 nextUnlockIndex;
    }

    struct LockedBalance {
        uint112 amount;
        uint32 unlockTime;
    }

    struct Epoch {
        uint224 supply; //epoch boosted supply
        uint32 date; //epoch start date
    }

    //token constants
    IERC20 public constant stakingToken = IERC20(0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B); //BTRFLY

    bool public isShutdown = false;

    // Duration that rewards are streamed over
    uint256 public constant REWARDS_DURATION = 7 days;

    // Duration of lock/earned penalty period
    uint256 public constant lockDuration = REWARDS_DURATION * 16;

    uint256 public constant denominator = 10000;

    //supplies and epochs
    uint256 public lockedSupply;
    Epoch[] public epochs;

    //mappings for balance data
    mapping(address => Balances) public balances;
    mapping(address => LockedBalance[]) public userLocks;

    constructor() {
        epochs.push(Epoch({supply: 0, date: uint32(block.timestamp)}));
    }

    function lock(
        address _account,
        uint256 _amount,
        uint256 _spendRatio
    ) external override nonReentrant {
        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        //lock
        _lock(_account, _amount, _spendRatio, false);
    }

    function _lock(
        address _account,
        uint256 _amount,
        uint256 _spendRatio,
        bool _isRelock
    ) internal {
        require(_amount > 0, "Cannot stake 0");
        require(!isShutdown, "shutdown");

        Balances storage bal = balances[_account];

        //must try check pointing epoch first
        _checkpointEpoch();

        //calc lock and boosted amount
        uint256 spendAmount = (_amount * _spendRatio) / denominator;
        uint112 lockAmount = (_amount - spendAmount).to112();

        //add user balances
        bal.locked = bal.locked + lockAmount;

        //add to total supplies
        lockedSupply = lockedSupply + lockAmount;

        //add user lock records or add to current
        uint256 lockEpoch = (block.timestamp / REWARDS_DURATION) * REWARDS_DURATION;
        //if a fresh lock, add on an extra duration period
        if (!_isRelock) {
            lockEpoch = lockEpoch + REWARDS_DURATION;
        }
        uint256 unlockTime = lockEpoch + lockDuration;
        uint256 idx = userLocks[_account].length;

        //if the latest user lock is smaller than this lock, always just add new entry to the end of the list
        if (idx == 0 || userLocks[_account][idx - 1].unlockTime < unlockTime) {
            userLocks[_account].push(
                LockedBalance({amount: lockAmount, unlockTime: uint32(unlockTime)})
            );
        } else {
            //else add to a current lock

            //if latest lock is further in the future, lower index
            //this can only happen if relocking an expired lock after creating a new lock
            if (userLocks[_account][idx - 1].unlockTime > unlockTime) {
                idx--;
            }

            //if idx points to the epoch when same unlock time, update
            //(this is always true with a normal lock but maybe not with relock)
            if (userLocks[_account][idx - 1].unlockTime == unlockTime) {
                LockedBalance storage userL = userLocks[_account][idx - 1];
                userL.amount = userL.amount + lockAmount;
            } else {
                //can only enter here if a relock is made after a lock and there's no lock entry
                //for the current epoch.
                //ex a list of locks such as "[...][older][current*][next]" but without a "current" lock
                //length - 1 is the next epoch
                //length - 2 is a past epoch
                //thus need to insert an entry for current epoch at the 2nd to last entry
                //we will copy and insert the tail entry(next) and then overwrite length-2 entry

                //reset idx
                idx = userLocks[_account].length;

                //get current last item
                LockedBalance storage userL = userLocks[_account][idx - 1];

                //add a copy to end of list
                userLocks[_account].push(
                    LockedBalance({amount: userL.amount, unlockTime: userL.unlockTime})
                );

                //insert current epoch lock entry by overwriting the entry at length-2
                userL.amount = lockAmount;
                userL.unlockTime = uint32(unlockTime);
            }
        }

        //update epoch supply, epoch checkpointed above so safe to add to latest
        uint256 eIndex = epochs.length - 1;
        //if relock, epoch should be current and not next, thus need to decrease index to length-2
        if (_isRelock) {
            eIndex--;
        }

        emit Locked(_account, lockEpoch, _amount, lockAmount);
    }

    //insert a new epoch if needed. fill in any gaps
    function _checkpointEpoch() internal {
        //create new epoch in the future where new non-active locks will lock to
        uint256 nextEpoch = ((block.timestamp / REWARDS_DURATION) * REWARDS_DURATION) +
            REWARDS_DURATION;
        uint256 epochindex = epochs.length;

        //first epoch add in constructor, no need to check 0 length

        //check to add
        if (epochs[epochindex - 1].date < nextEpoch) {
            //fill any epoch gaps
            while (epochs[epochs.length - 1].date != nextEpoch) {
                uint256 nextEpochDate = uint256(epochs[epochs.length - 1].date) + REWARDS_DURATION;
                epochs.push(Epoch({supply: 0, date: uint32(nextEpochDate)}));
            }
        }
    }

    /* ========== EVENTS ========== */
    event RewardAdded(address indexed _token, uint256 _reward);
    event Locked(
        address indexed _user,
        uint256 indexed _epoch,
        uint256 _paidAmount,
        uint256 _lockedAmount
    );
    event Withdrawn(address indexed _user, uint256 _amount, bool _relocked);
    event KickReward(address indexed _user, address indexed _kicked, uint256 _reward);
    event RewardPaid(address indexed _user, address indexed _rewardsToken, uint256 _reward);
    event Recovered(address _token, uint256 _amount);
}
