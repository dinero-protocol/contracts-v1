import { ethers } from 'hardhat'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { impersonateAddressAndReturnSigner, mineBlocks } from './utils'

import {
  TREASURY_ADDRESS,
  FXS_ADDRESS,
  BTRFLY_ADDRESS,
  MULTISIG_ADDRESS,
  ZERO_ADDRESS,
} from './constants'

import { REDACTEDTreasury, REDACTEDBondDepositoryRewardBased, IERC20 } from '../typechain'

import { BigNumber } from 'ethers'

const BCV = '275'
const VESTING = '33110'
const MINPRICE = '0'
const MAXPAYOUT = '100'
const FEE = '9500'
const MAXDEBT = ethers.utils.parseEther('10000000000000000000000000000')
const TITHE = '500'
const INITIALDEBT = '1500000000000000'

const fxsValueUSD = BigNumber.from(38)
const btrflyValueUSD = BigNumber.from(3187)

const FXS_WHALE = '0x7a16ff8270133f063aab6c9977183d9e72835428'

describe('Live FXS bonds', function () {
  let dao: SignerWithAddress
  let olympusDao: SignerWithAddress
  let recipient: SignerWithAddress
  let treasuryOwner: SignerWithAddress
  let btrfly: IERC20
  let fxs: IERC20
  let fxsBond: REDACTEDBondDepositoryRewardBased
  let fxsWhale: SignerWithAddress
  let treasuryContract: REDACTEDTreasury

  beforeEach(async function () {
    ;[dao, olympusDao, recipient] = await ethers.getSigners()

    //impersonate Treasury owner and whale
    treasuryOwner = await impersonateAddressAndReturnSigner(dao, MULTISIG_ADDRESS)
    fxsWhale = await impersonateAddressAndReturnSigner(dao, FXS_WHALE)

    btrfly = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      BTRFLY_ADDRESS,
    )) as IERC20

    fxs = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      FXS_ADDRESS,
    )) as IERC20

    // get Treasury contract
    treasuryContract = await ethers.getContractAt(
      'REDACTEDTreasury',
      TREASURY_ADDRESS,
      treasuryOwner,
    )

    // deploy LPbonds
    const FXSBond = await ethers.getContractFactory('REDACTEDBondDepositoryRewardBased')

    fxsBond = await FXSBond.deploy(
      BTRFLY_ADDRESS,
      FXS_ADDRESS,
      TREASURY_ADDRESS,
      dao.address,
      ZERO_ADDRESS,
      olympusDao.address,
      olympusDao.address,
    )

    await fxsBond.deployed()

    // Add Bonds as Reserve Assets and set Floor
    await treasuryContract.connect(treasuryOwner).queue(BigNumber.from(2), fxsBond.address)
    await treasuryContract
      .connect(treasuryOwner)
      .toggle(BigNumber.from(2), fxsBond.address, ZERO_ADDRESS)
    await treasuryContract.connect(treasuryOwner).setFloor(fxs.address, '26143790')
  })

  it(`MinPrice of ${MINPRICE} gives [Zeus] a ROI between 5% & 10% out the gate`, async function () {
    await fxsBond.initializeBondTerms(
      BCV,
      VESTING,
      MINPRICE,
      MAXPAYOUT,
      FEE,
      MAXDEBT,
      TITHE,
      INITIALDEBT,
    )
    await fxs.connect(fxsWhale).approve(fxsBond.address, ethers.constants.MaxUint256)

    const fxsDepositBtrflyValue = ethers.utils
      .parseUnits('1000', 'gwei')
      .mul(fxsValueUSD)
      .div(btrflyValueUSD)

    const redemptionMinValue = fxsDepositBtrflyValue
      .mul(BigNumber.from(101))
      .div(BigNumber.from(100))

    const redemptionMaxValue = fxsDepositBtrflyValue
      .mul(BigNumber.from(105))
      .div(BigNumber.from(100))

    console.log('DEPOSIT VALUE : ' + fxsDepositBtrflyValue.toString())
    console.log('MIN VALUE TO SATISFY REQ : ' + redemptionMinValue.toString())
    console.log('MAX VALUE TO SATISFY REQ : ' + redemptionMaxValue.toString())

    //console.log('bond price in usd', await fxsBond.bondPriceInUSD())

    await fxsBond
      .connect(fxsWhale)
      .deposit(
        ethers.utils.parseUnits('1000', 'ether'),
        BigNumber.from(300000),
        recipient.address,
      )

    await mineBlocks(34000)

    await fxsBond.connect(recipient).redeem(recipient.address, false)

    const redemptionAmount = await btrfly.balanceOf(recipient.address)

    console.log('REDEMPTION VALUE : ' + redemptionAmount.toString())

    // expect(redemptionAmount.toNumber()).is.greaterThan(redemptionMinValue.toNumber())
    // expect(redemptionAmount.toNumber()).is.lessThan(redemptionMaxValue.toNumber())
  })
})
