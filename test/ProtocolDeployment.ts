/* eslint-disable camelcase */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'
import {
  BTRFLY__factory,
  CRV__factory,
  Distributor__factory,
  REDACTEDBondDepository__factory,
  REDACTEDTreasury__factory,
  StakingHelper__factory,
  StakingWarmup__factory,
  XBTRFLY__factory,
} from '../typechain'

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

export const deployCvxBond = async () => {}
