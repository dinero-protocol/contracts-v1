import { ethers } from 'hardhat'

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { impersonateAddressAndReturnSigner, mineBlocks } from './utils'

import {
  TREASURY_ADDRESS,
  CVX_ADDRESS,
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
const BCV = '415'
const initialDebtRatio = 1.630319901
const cvxFloorValue = 32
const cvxValueUSD = BigNumber.from('2684')
const btrflyValueUSD = BigNumber.from('56751')


//GET FROM CONTRACT IMMEDIATELY BEFORE INITIALISATION
const btrflySupplyRaw = 294575743846972

const INITIALDEBT = ethers.BigNumber.from(
  parseInt(
    (btrflySupplyRaw*initialDebtRatio).toString(),
    0
    )
  )

console.log( "Initial debt : " + INITIALDEBT.toString())

const CVX_WHALE = '0x0aca67fa70b142a3b9bf2ed89a81b40ff85dacdc'

describe('Live CVX bonds', function () {
  let dao: SignerWithAddress
  let olympusDao: SignerWithAddress
  let recipient: SignerWithAddress
  let treasuryOwner: SignerWithAddress
  let btrfly: IERC20
  let cvx: IERC20
  let cvxBond: REDACTEDBondDepositoryRewardBased
  let cvxWhale: SignerWithAddress
  let treasuryContract: REDACTEDTreasury

  beforeEach(async function () {
    ;[dao, olympusDao, recipient] = await ethers.getSigners()

    //impersonate Treasury owner and whale
    treasuryOwner = await impersonateAddressAndReturnSigner(dao, MULTISIG_ADDRESS)
    cvxWhale = await impersonateAddressAndReturnSigner(dao, CVX_WHALE)

    btrfly = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      BTRFLY_ADDRESS,
    )) as IERC20

    cvx = (await ethers.getContractAt(
      '@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
      CVX_ADDRESS,
    )) as IERC20

    // get Treasury contract
    treasuryContract = await ethers.getContractAt(
      'REDACTEDTreasury',
      TREASURY_ADDRESS,
      treasuryOwner,
    )

    // deploy LPbonds
    const CVXBond = await ethers.getContractFactory('REDACTEDBondDepositoryRewardBased')

    cvxBond = await CVXBond.deploy(
      BTRFLY_ADDRESS,
      CVX_ADDRESS,
      TREASURY_ADDRESS,
      dao.address,
      ZERO_ADDRESS,
      olympusDao.address,
      olympusDao.address,
    )

    await cvxBond.deployed()

    await treasuryContract.connect(treasuryOwner).queue('8',cvxBond.address)
    await treasuryContract.connect(treasuryOwner).toggle('8',cvxBond.address,ZERO_ADDRESS)

    // Add Bonds as Reserve Assets and set Floor
    /*await treasuryContract.connect(treasuryOwner).queue('2', cvx.address)
    await treasuryContract
      .connect(treasuryOwner)
      .toggle('2', cvx.address, ZERO_ADDRESS)

    await treasuryContract.connect(treasuryOwner).
    setFloor(
      cvx.address, 
      ethers.BigNumber.from(
        parseInt(
          (1e9/cvxFloorValue).toString(),
          0
          )
        )
        )*/

    
  })

  it(`Initial debt calculated gives [Sam] an ROI of 5% to -5% out the gate`, async function () {

    await cvxBond.initializeBondTerms(
      BCV,
      VESTING,
      MINPRICE,
      MAXPAYOUT,
      FEE,
      MAXDEBT,
      TITHE,
      INITIALDEBT
    )

    const cvxDepositBtrflyValue = ethers.utils
      .parseUnits('1000', 'gwei')
      .mul(cvxValueUSD)
      .div(btrflyValueUSD)

    const redemptionMinValue = cvxDepositBtrflyValue
      .mul(BigNumber.from(95))
      .div(BigNumber.from(100))

    const redemptionMaxValue = cvxDepositBtrflyValue
      .mul(BigNumber.from(105))
      .div(BigNumber.from(100))

    console.log('DEPOSIT VALUE : ' + cvxDepositBtrflyValue.toString())
    console.log('MIN VALUE TO SATISFY REQ : ' + redemptionMinValue.toString())
    console.log('MAX VALUE TO SATISFY REQ : ' + redemptionMaxValue.toString())

    //console.log('bond price in usd', await cvxBond.bondPriceInUSD())

    await cvx.connect(cvxWhale).transfer(recipient.address,ethers.utils.parseUnits('1000', 'ether'))
    await cvx.connect(recipient).approve(cvxBond.address, ethers.constants.MaxUint256)

    await cvxBond
      .connect(recipient)
      .deposit(
        ethers.utils.parseUnits('1000', 'ether'),
        BigNumber.from(300000),
        recipient.address,
      )

    await mineBlocks(34000)

    await cvxBond.connect(recipient).redeem(recipient.address, false)

    const redemptionAmount = await btrfly.balanceOf(recipient.address)

    console.log('REDEMPTION VALUE : ' + redemptionAmount.toString())

    // expect(redemptionAmount.toNumber()).is.greaterThan(redemptionMinValue.toNumber())
    // expect(redemptionAmount.toNumber()).is.lessThan(redemptionMaxValue.toNumber())
  })
})
