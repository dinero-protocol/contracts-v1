import { expect } from 'chai'
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

const BCV = '275'
const VESTING = '33110'
const MINPRICE = '0'
const MAXPAYOUT = '100'
const FEE = '9500'
const MAXDEBT = ethers.utils.parseEther('10000000000000000000000000000')
const TITHE = '500'
const INITIALDEBT = '1500000000000000'

const cvxValueUSD = BigNumber.from(47)
const btrflyValueUSD = BigNumber.from(2900)

const CVX_WHALE = '0x0aca67fa70b142a3b9bf2ed89a81b40ff85dacdc'

describe('Live CVX bonds', function () {
  let dao: SignerWithAddress
  let olympusDao: SignerWithAddress
  let recipient: SignerWithAddress

  let treasuryOwner: SignerWithAddress

  let treasuryContract: REDACTEDTreasury
  let lpToken: IERC20
  let btrfly: IERC20
  let cvx: IERC20
  let cvxBond: REDACTEDBondDepositoryRewardBased
  let cvxWhale: SignerWithAddress

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

    //get Treasury contract
    const treasuryContract = await ethers.getContractAt(
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

    // Add LPbonds as LP depositor (INITIALISE FIRST IN PROD PLS FS - SO WE CAN VERIFY VARS FIRST)

    await treasuryContract.queue(BigNumber.from(8), cvxBond.address)

    await treasuryContract.toggle(BigNumber.from(8), cvxBond.address, ZERO_ADDRESS)
  })

  it(`MinPrice of ${MINPRICE} gives [Zeus] a discount between 15% & 25% out the gate`, async function () {
    await cvxBond.initializeBondTerms(
      BCV,
      VESTING,
      MINPRICE,
      MAXPAYOUT,
      FEE,
      MAXDEBT,
      TITHE,
      INITIALDEBT,
    )

    await cvx.connect(cvxWhale).approve(cvxBond.address, ethers.constants.MaxUint256)

    const cvxDepositBtrflyValue = ethers.utils
      .parseUnits('100', 'gwei')
      .mul(cvxValueUSD)
      .div(btrflyValueUSD)

    const redemptionMinValue = cvxDepositBtrflyValue
      .mul(BigNumber.from(117))
      .div(BigNumber.from(100))

    const redemptionMaxValue = cvxDepositBtrflyValue
      .mul(BigNumber.from(133))
      .div(BigNumber.from(100))

    console.log('DEPOSIT VALUE : ' + cvxDepositBtrflyValue.toString())
    console.log('MIN VALUE TO SATISFY REQ : ' + redemptionMinValue.toString())
    console.log('MAX VALUE TO SATISFY REQ : ' + redemptionMaxValue.toString())

    await cvxBond
      .connect(cvxWhale)
      .deposit(
        ethers.utils.parseUnits('100', 'ether'),
        BigNumber.from(300000),
        recipient.address,
      )

    await mineBlocks(34000)

    await cvxBond.connect(recipient).redeem(recipient.address, false)

    const redemptionAmount = await btrfly.balanceOf(recipient.address)

    console.log('REDEMPTION VALUE : ' + redemptionAmount.toString())

    expect(redemptionAmount.toNumber()).is.greaterThan(redemptionMinValue.toNumber())
    expect(redemptionAmount.toNumber()).is.lessThan(redemptionMaxValue.toNumber())
  })

  /**it("Pays correct fees to Olympus DAO", async function(){

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

        await cvx.connect(cvxWhale).approve(
            cvxBond.address,
            ethers.constants.MaxUint256
        )

        await lpBond.connect(lpWhale).deposit(
            ethers.utils.parseUnits('1','gwei'),
            BigNumber.from(30000),
            recipient.address
        )

        await mineBlocks(34000);

        await lpBond.connect(recipient).redeem(recipient.address,false);

        const ohmBalance = await lpToken.balanceOf(olympusDao.address)
        expect(Number(ethers.utils.formatEther(ohmBalance))).to.be.greaterThan(0)
        console.log('ohm dao balance', ethers.utils.formatEther(ohmBalance))

        const ohmBtrflyBalance = await btrfly.balanceOf(olympusDao.address)
        expect(Number(ethers.utils.formatEther(ohmBtrflyBalance))).to.be.greaterThan(0)
        console.log('ohm dao balance', ethers.utils.formatEther(ohmBtrflyBalance))

    })**/
})
