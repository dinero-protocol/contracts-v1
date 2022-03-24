// stores locked BTRFLY
// only authorised parties can call this
// - multisig
// - lockTokenContract

// future iterations may support depositing locked capital on fuse etc

import "@rari-capital/solmate/src/tokens/ERC20.sol";
import "@rari-capital/solmate/src/auth/Auth.sol";

import "./interfaces/ILockVault.sol";

contract LockVault is ILockVault, Auth{

    ERC20 public btrfly;

    constructor(
            address owner_,
            address authority_,
            address btrfly_
        )
        Auth(owner_,Authority(authority_)){
            btrfly = ERC20(_btrfly);
        }

    function deposit(uint amount) external override requiresAuth{
        btrfly.transferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint amount) external override requiresAuth{
        btrfly.transfer(msg.sender, amount);
    }

}