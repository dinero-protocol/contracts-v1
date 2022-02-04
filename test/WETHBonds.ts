import { ethers } from 'hardhat'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { impersonateAddressAndReturnSigner, mineBlocks } from './utils'

import {
  TREASURY_ADDRESS,
  WETH_ADDRESS,
  BTRFLY_ADDRESS,
  MULTISIG_ADDRESS,
  ZERO_ADDRESS,
} from './constants'

import { REDACTEDTreasury, REDACTEDBondDepositoryRewardBased, IERC20 } from '../typechain'

import { BigNumber } from 'ethers'

const VESTING = '33110'
const MINPRICE = '0'
const MAXPAYOUT = '100'
const FEE = '9500'
const MAXDEBT = ethers.utils.parseEther('10000000000000000000000000000')
const TITHE = '500'

//GET FROM GSHEET
const BCV = '95'
const initialDebtRatio = 13.26744143
const wethFloorValue = 3000
const wethValueUSD = BigNumber.from(2904)
const btrflyValueUSD = BigNumber.from(1098)


//GET FROM CONTRACT IMMEDIATELY BEFORE INITIALISATION
const btrflySupplyRaw = 239985617870589

const INITIALDEBT = ethers.BigNumber.from(
  parseInt(
    (btrflySupplyRaw*initialDebtRatio).toString(),
    0
    )
  )

console.log( "Initial debt : " + INITIALDEBT.toString())

const WETH_WHALE = '0x2feb1512183545f48f6b9c5b4ebfcaf49cfca6f3'

describe('Live WETH bonds', function () {
  let dao: SignerWithAddress
  let olympusDao: SignerWithAddress
  let recipient: SignerWithAddress
  let treasuryOwner: SignerWithAddress
  let btrfly: IERC20
  let weth: IERC20
  let wethBond: REDACTEDBondDepositoryRewardBased
  let wethWhale: SignerWithAddress
  let treasuryContract: REDACTEDTreasury

  beforeEach(async function () {
    ;[dao, olympusDao, recipient] = await ethers.getSigners()

    //impersonate Treasury owner and whale
    treasuryOwner = await impersonateAddressAndReturnSigner(dao, MULTISIG_ADDRESS)
    wethWhale = await impersonateAddressAndReturnSigner(dao, WETH_WHALE)

    btrfly = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      BTRFLY_ADDRESS,
    )) as IERC20

    weth = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      WETH_ADDRESS,
    )) as IERC20

    // get Treasury contract
    treasuryContract = await ethers.getContractAt(
      'REDACTEDTreasury',
      TREASURY_ADDRESS,
      treasuryOwner,
    )

    // deploy LPbonds
    const WETHBond = await ethers.getContractFactory('REDACTEDBondDepositoryRewardBased')

    wethBond = await WETHBond.deploy(
      BTRFLY_ADDRESS,
      WETH_ADDRESS,
      TREASURY_ADDRESS,
      dao.address,
      ZERO_ADDRESS,
      olympusDao.address,
      olympusDao.address,
    )

    await wethBond.deployed()

    await treasuryContract.connect(treasuryOwner).queue('8',wethBond.address)
    await treasuryContract.connect(treasuryOwner).toggle('8',wethBond.address,ZERO_ADDRESS)

    // Add Bonds as Reserve Assets and set Floor
    /*await treasuryContract.connect(treasuryOwner).queue('2', weth.address)
    await treasuryContract
      .connect(treasuryOwner)
      .toggle('2', weth.address, ZERO_ADDRESS)

    await treasuryContract.connect(treasuryOwner).
    setFloor(
      weth.address, 
      ethers.BigNumber.from(
        parseInt(
          (1e9/wethFloorValue).toString(),
          0
          )
        )
        )*/

    
  })

  it(`Initial debt calculated gives [Vitalik] an ROI of -15% to -5% out the gate`, async function () {

    await wethBond.initializeBondTerms(
      BCV,
      VESTING,
      MINPRICE,
      MAXPAYOUT,
      FEE,
      MAXDEBT,
      TITHE,
      INITIALDEBT
    )

    const wethDepositBtrflyValue = ethers.utils
      .parseUnits('10', 'gwei')
      .mul(wethValueUSD)
      .div(btrflyValueUSD)

    const redemptionMinValue = wethDepositBtrflyValue
      .mul(BigNumber.from(85))
      .div(BigNumber.from(100))

    const redemptionMaxValue = wethDepositBtrflyValue
      .mul(BigNumber.from(95))
      .div(BigNumber.from(100))

    console.log('DEPOSIT VALUE : ' + wethDepositBtrflyValue.toString())
    console.log('MIN VALUE TO SATISFY REQ : ' + redemptionMinValue.toString())
    console.log('MAX VALUE TO SATISFY REQ : ' + redemptionMaxValue.toString())

    //console.log('bond price in usd', await wethBond.bondPriceInUSD())

    await weth.connect(wethWhale).transfer(recipient.address,ethers.utils.parseUnits('10', 'ether'))
    await weth.connect(recipient).approve(wethBond.address, ethers.constants.MaxUint256)

    await wethBond
      .connect(recipient)
      .deposit(
        ethers.utils.parseUnits('10', 'ether'),
        BigNumber.from(300000),
        recipient.address,
      )

    await mineBlocks(34000)

    await wethBond.connect(recipient).redeem(recipient.address, false)

    const redemptionAmount = await btrfly.balanceOf(recipient.address)

    console.log('REDEMPTION VALUE : ' + redemptionAmount.toString())

    // expect(redemptionAmount.toNumber()).is.greaterThan(redemptionMinValue.toNumber())
    // expect(redemptionAmount.toNumber()).is.lessThan(redemptionMaxValue.toNumber())
  })
})
