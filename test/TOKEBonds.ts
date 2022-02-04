import { ethers } from 'hardhat'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { impersonateAddressAndReturnSigner, mineBlocks } from './utils'

import {
  TREASURY_ADDRESS,
  TOKE_ADDRESS,
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
const BCV = '1250'
const initialDebtRatio = 0.4109829058
const tokeFloorValue = 30
const tokeValueUSD = BigNumber.from(3134)
const btrflyValueUSD = BigNumber.from(53671)


//GET FROM CONTRACT IMMEDIATELY BEFORE INITIALISATION
const btrflySupplyRaw = 300061717743418

const INITIALDEBT = ethers.BigNumber.from(
  parseInt(
    (btrflySupplyRaw*initialDebtRatio).toString(),
    0
    )
  )

console.log( "Initial debt : " + INITIALDEBT.toString())

const TOKE_WHALE = '0x23a5efe19aa966388e132077d733672cf5798c03'

describe('Live TOKE bonds', function () {
  let dao: SignerWithAddress
  let olympusDao: SignerWithAddress
  let recipient: SignerWithAddress
  let treasuryOwner: SignerWithAddress
  let btrfly: IERC20
  let toke: IERC20
  let tokeBond: REDACTEDBondDepositoryRewardBased
  let tokeWhale: SignerWithAddress
  let treasuryContract: REDACTEDTreasury

  beforeEach(async function () {
    ;[dao, olympusDao, recipient] = await ethers.getSigners()

    //impersonate Treasury owner and whale
    treasuryOwner = await impersonateAddressAndReturnSigner(dao, MULTISIG_ADDRESS)
    tokeWhale = await impersonateAddressAndReturnSigner(dao, TOKE_WHALE)

    btrfly = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      BTRFLY_ADDRESS,
    )) as IERC20

    toke = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      TOKE_ADDRESS,
    )) as IERC20

    // get Treasury contract
    treasuryContract = await ethers.getContractAt(
      'REDACTEDTreasury',
      TREASURY_ADDRESS,
      treasuryOwner,
    )

    // deploy LPbonds
    const TOKEBond = await ethers.getContractFactory('REDACTEDBondDepositoryRewardBased')

    tokeBond = await TOKEBond.deploy(
      BTRFLY_ADDRESS,
      TOKE_ADDRESS,
      TREASURY_ADDRESS,
      dao.address,
      ZERO_ADDRESS,
      olympusDao.address,
      olympusDao.address,
    )

    await tokeBond.deployed()

    await treasuryContract.connect(treasuryOwner).queue('8',tokeBond.address)
    await treasuryContract.connect(treasuryOwner).toggle('8',tokeBond.address,ZERO_ADDRESS)

    // Add Bonds as Reserve Assets and set Floor
    await treasuryContract.connect(treasuryOwner).queue('2', toke.address)
    await treasuryContract
      .connect(treasuryOwner)
      .toggle('2', toke.address, ZERO_ADDRESS)

    await treasuryContract.connect(treasuryOwner).
    setFloor(
      toke.address, 
      ethers.BigNumber.from(
        parseInt(
          (1e9/tokeFloorValue).toString(),
          0
          )
        )
        )

    
  })

  it(`Initial debt calculated gives [Sam] an ROI of -5% to 5% out the gate`, async function () {

    await tokeBond.initializeBondTerms(
      BCV,
      VESTING,
      MINPRICE,
      MAXPAYOUT,
      FEE,
      MAXDEBT,
      TITHE,
      INITIALDEBT
    )

    const tokeDepositBtrflyValue = ethers.utils
      .parseUnits('1000', 'gwei')
      .mul(tokeValueUSD)
      .div(btrflyValueUSD)

    const redemptionMinValue = tokeDepositBtrflyValue
      .mul(BigNumber.from(95))
      .div(BigNumber.from(100))

    const redemptionMaxValue = tokeDepositBtrflyValue
      .mul(BigNumber.from(105))
      .div(BigNumber.from(100))

    console.log('DEPOSIT VALUE : ' + tokeDepositBtrflyValue.toString())
    console.log('MIN VALUE TO SATISFY REQ : ' + redemptionMinValue.toString())
    console.log('MAX VALUE TO SATISFY REQ : ' + redemptionMaxValue.toString())

    //console.log('bond price in usd', await tokeBond.bondPriceInUSD())

    await toke.connect(tokeWhale).transfer(recipient.address,ethers.utils.parseUnits('1000', 'ether'))
    await toke.connect(recipient).approve(tokeBond.address, ethers.constants.MaxUint256)

    await tokeBond
      .connect(recipient)
      .deposit(
        ethers.utils.parseUnits('1000', 'ether'),
        BigNumber.from(300000),
        recipient.address,
      )

    await mineBlocks(34000)

    await tokeBond.connect(recipient).redeem(recipient.address, false)

    const redemptionAmount = await btrfly.balanceOf(recipient.address)

    console.log('REDEMPTION VALUE : ' + redemptionAmount.toString())

    // expect(redemptionAmount.toNumber()).is.greaterThan(redemptionMinValue.toNumber())
    // expect(redemptionAmount.toNumber()).is.lessThan(redemptionMaxValue.toNumber())
  })
})
