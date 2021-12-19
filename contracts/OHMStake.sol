//deposits IOU-OHM
//withdraws OHM
//uses staking helper to stake it
//deposits sOHM
//withdraws IOU-OHM
//burns it

interface IERC20 {
    function decimals() external view returns (uint8);

    function totalSupply() external view returns (uint256);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address recipient, uint256 amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint256);

    function approve(address spender, uint256 amount) external returns (bool);

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);

    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface ITreasury {
    function deposit( uint _amount, address _token, uint _profit ) external returns ( uint );
    function simp( uint _amount, address _token ) external;
    function valueOf( address _token, uint _amount ) external view returns ( uint value_ );
    function manage( address _token, uint _amount ) external;
    function auditReserves() external;
}

interface IStaking {
    function stake( uint _amount, address _recipient ) external returns ( bool );
    function claim( address _recipient ) external;
}

interface IReserveIOU {
    function mint(address recipient, uint256 amount) external;
    function burn(uint amount) external;
}

contract OHMStake {

    address public immutable OHM;
    address public immutable sOHM;
    address public immutable treasury;
    address public immutable ohmStaking;
    address public immutable OHMIOU;

    constructor(
        address _OHM,
        address _sOHM,
        address _treasury,
        address _ohmStaking,
        address _OHMIOU
    ){
        OHM = _OHM;
        sOHM = _sOHM;
        treasury = _treasury;
        ohmStaking = _ohmStaking;
        OHMIOU = _OHMIOU;
    }

    function stakeOHMInTreasury() external{
        // draw all of the treasury's OHM, using the IOU as a tool to avoid hitting excess reserve limits
        uint256 ohmBalance = IERC20(OHM).balanceOf(treasury);
        IReserveIOU(OHMIOU).mint(address(this),ohmBalance);
        IERC20(OHMIOU).approve(treasury,ohmBalance);
        ITreasury(treasury).simp(ohmBalance, OHMIOU); //simp is shorthand for deposit where all value is profit
        ITreasury(treasury).manage(OHM, ohmBalance);
        //staking stuff
        IERC20( OHM ).approve( ohmStaking, ohmBalance );
        IStaking( ohmStaking ).stake( ohmBalance, treasury );
        IStaking( ohmStaking ).claim( treasury );
        //audit reserves to reflect new sOHM and rebasing
        ITreasury(treasury).auditReserves();
        //burn the IOU
        ITreasury(treasury).manage(OHMIOU, ohmBalance);
        IReserveIOU(OHMIOU).burn(ohmBalance);
    }

}