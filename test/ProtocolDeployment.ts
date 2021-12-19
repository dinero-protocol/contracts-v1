/* eslint-disable camelcase */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import { ethers } from 'hardhat'
import {
  BTRFLY,
  BTRFLY__factory,
  CRV,
  CRV__factory,
  CVX,
  Distributor,
  Distributor__factory,
  REDACTEDBondDepository__factory,
  REDACTEDStaking,
  REDACTEDStaking__factory,
  REDACTEDTreasury,
  REDACTEDTreasury__factory,
  StakingHelper__factory,
  StakingWarmup__factory,
  XBTRFLY,
  XBTRFLY__factory,
} from '../typechain'
import { ZERO_ADDRESS } from './constants'

export const deployCRV = async () => {
  const CrvFactory = (await ethers.getContractFactory('CRV')) as CRV__factory
  const crv = await CrvFactory.deploy()
  return crv
}

export const deployCVX = async () => {
  const CvxFactory = (await ethers.getContractFactory('CVX')) as CRV__factory
  const cvx = await CvxFactory.deploy()
  return cvx
}

export const deployBtrfly = async () => {
  const BtrflyFactory = (await ethers.getContractFactory('BTRFLY')) as BTRFLY__factory
  const btrfly = await BtrflyFactory.deploy()
  return btrfly
}

export const deployXbtrfly = async () => {
  const xBtrflyFactory = (await ethers.getContractFactory('XBTRFLY')) as XBTRFLY__factory
  const xbtrfly = await xBtrflyFactory.deploy()
  return xbtrfly
}

/**
 *
 * @param btrfly
 * @param ohm
 * @param sOhm
 * @param cvx
 * @param crv
 * @param btrflyOhm
 * @param ohmFloor //!VAR
 * @param cvxFloor //!VAR
 * @param crvFloor //!VAR
 * @param newBlocksQueue //!VAR
 * @returns
 */
export const deployTreasury = async (
  btrfly: string,
  ohm: string,
  sOhm: string,
  cvx: string,
  crv: string,
  btrflyOhm: string,
  ohmFloor: string,
  cvxFloor: string,
  crvFloor: string,
  newBlocksQueue: string,
) => {
  const TreasuryFactory = (await ethers.getContractFactory(
    'REDACTEDTreasury',
  )) as REDACTEDTreasury__factory
  const treasury = await TreasuryFactory.deploy(
    btrfly,
    ohm,
    sOhm,
    cvx,
    crv,
    btrflyOhm,
    ohmFloor,
    cvxFloor,
    crvFloor,
    newBlocksQueue,
  )

  return treasury
}

export const deployStaking = async (
  btrfly: string,
  xbtrfly: string,
  epochLengthInBlocks: number,
  firstEpochNumber: number,
  firstEpochBlock: number,
) => {
  const StakingFactory = (await ethers.getContractFactory(
    'REDACTEDStaking',
  )) as REDACTEDStaking__factory

  const staking = await StakingFactory.deploy(
    btrfly,
    xbtrfly,
    epochLengthInBlocks,
    firstEpochNumber,
    firstEpochBlock,
  )

  return staking
}

export const deployBondingCalculator = async (btrfly: string) => {
  const bondCalculatorFactory = await ethers.getContractFactory('REDACTEDBondingCalculator')
  const bondCalculator = await bondCalculatorFactory.deploy(btrfly)
  return bondCalculator
}

export const deployStakingDistributor = async (
  treasury: string,
  btrfly: string,
  epochLength: number,
  nextEpochBlock: number,
) => {
  const StakingDistroFactory = (await ethers.getContractFactory(
    'Distributor',
  )) as Distributor__factory

  const distributor = await StakingDistroFactory.deploy(
    treasury,
    btrfly,
    epochLength,
    nextEpochBlock,
  )
  return distributor
}

export const deployWarmup = async (staking: string, btrfly: string) => {
  const WarmupFactory = (await ethers.getContractFactory(
    'StakingWarmup',
  )) as StakingWarmup__factory

  const warmup = await WarmupFactory.deploy(staking, btrfly)
  return warmup
}

export const deployStakingHelper = async (staking: string, btrfly: string) => {
  const StakingHelperFactory = (await ethers.getContractFactory(
    'StakingHelper',
  )) as StakingHelper__factory

  const stakingHelper = await StakingHelperFactory.deploy(staking, btrfly)
  return stakingHelper
}

// const daiBond = await DAIBond.deploy(ohm.address, dai.address, treasury.address, MockDAO.address, zeroAddress);

export const deployBond = async (
  btrfly: string,
  principle: string,
  treasury: string,
  dao: string,
  bondCalculator: string,
  ohmDao: string,
  ohmTreasury: string,
  bcv: string,
  vesting: number,
  minBondPrice: string,
  maxBondPayout: string,
  bondFee: number,
  maxBondDebt: string,
  tithe: string,
  initialDebt: string,
  staking: string,
  helper: boolean,
) => {
  const BondFactory = (await ethers.getContractFactory(
    'REDACTEDBondDepository',
  )) as REDACTEDBondDepository__factory

  const bond = await BondFactory.deploy(
    btrfly,
    principle,
    treasury,
    dao,
    bondCalculator,
    ohmDao,
    ohmTreasury,
  )

  await bond.initializeBondTerms(
    bcv,
    vesting,
    minBondPrice,
    maxBondPayout,
    bondFee,
    maxBondDebt,
    tithe,
    initialDebt,
  )

  await bond.setStaking(staking, helper)
}

export const setUpXbtrfly = async (xbtrfly: XBTRFLY, staking: string, initialIndex: string) => {
  await xbtrfly.initialize(staking)
  await xbtrfly.setIndex(initialIndex)
}

export const setUpStaking = async (
  staking: REDACTEDStaking,
  distributor: string,
  stakingWarmup: string,
  admin: SignerWithAddress,
) => {
  await staking.connect(admin).setContract('0', distributor)
  await staking.connect(admin).setContract('1', stakingWarmup)
}

export const setUpTreasury = async (
  btrfly: BTRFLY,
  treasury: string,
  admin: SignerWithAddress,
) => {
  await btrfly.connect(admin).setVault(treasury)
}

export const setUpDistributor = async (
  distributor: Distributor,
  staking: string,
  initialRewardRate: string,
  admin: SignerWithAddress,
) => {
  await distributor.connect(admin).addRecipient(staking, initialRewardRate)
}

export const queueAndToggleDistributor = async (
  treasury: REDACTEDTreasury,
  distributor: string,
  admin: SignerWithAddress,
) => {
  await treasury.connect(admin).queue('8', distributor)
  await treasury.connect(admin).toggle('8', distributor, ZERO_ADDRESS)
}

export const queueAndToggleReserveDepositor = async (
  treasury: REDACTEDTreasury,
  gnosisSafe: string,
  admin: SignerWithAddress,
) => {
  await treasury.connect(admin).queue('0', gnosisSafe)
  await treasury.connect(admin).toggle('0', gnosisSafe, ZERO_ADDRESS)
}
// if liquidty token we need to add the bond as liq depostor Lp bonds and gonsis safe
export const queueAndToggleLiquidityDepositorAsGnosis = async (
  treasury: REDACTEDTreasury,
  gnosisSafe: string,
  admin: SignerWithAddress,
) => {
  await treasury.connect(admin).queue('4', gnosisSafe)
  await treasury.connect(admin).toggle('4', gnosisSafe, ZERO_ADDRESS)
}

export const approveTreasuryToSpendERC20FromGnosis = async (
  token: CRV | CVX | Contract,
  treasury: string,
  gnosis: SignerWithAddress,
) => {
  await token.connect(gnosis).approve(treasury, ethers.utils.parseEther('10000000000000000'))
}

export const deployCvxBond = async () => {}
