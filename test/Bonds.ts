/* eslint-disable camelcase */
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { ethers } from 'hardhat'

import {
  BTRFLY,
  CRV,
  CRV__factory,
  CVX,
  REDACTEDBondDepository,
  REDACTEDBondDepository__factory,
  REDACTEDBondingCalculator,
  REDACTEDTreasury,
} from '../typechain'
import { BONDING_CALCULATOR, BTRFLY_ADDRESS, TREASURY_ADDRESS } from './constants'
import { getBondingCalculator, getBTRFLY, getTREASURY } from './utils'

describe('Bond Contract Mainnet Integrations', () => {
  let crvBond: REDACTEDBondDepository
  let bondCalculator: REDACTEDBondingCalculator
  let crv: CRV
  let cvx: CVX
  let btrfly: BTRFLY
  let treasury: REDACTEDTreasury
  let ohmDao: SignerWithAddress

  let admin: SignerWithAddress
  let bonder: SignerWithAddress

  beforeEach(async () => {
    ;[admin, bonder, ohmDao] = await ethers.getSigners()
    btrfly = await getBTRFLY(BTRFLY_ADDRESS)
    treasury = await getTREASURY(TREASURY_ADDRESS)
    bondCalculator = await getBondingCalculator(BONDING_CALCULATOR)
    const CrvFactory = (await ethers.getContractFactory('CRV')) as CRV__factory
    const CvxFactory = (await ethers.getContractFactory('CVX')) as CRV__factory
    crv = await CrvFactory.deploy()
    cvx = await CvxFactory.deploy()
    await crv.connect(bonder).mint(bonder.address)
    await cvx.connect(bonder).mint(bonder.address)
    await cvx.connect(admin).mint(bonder.address)
    await cvx.connect(admin).mint(treasury.address)
    await crv.connect(admin).mint(treasury.address)

    const BondFactory = (await ethers.getContractFactory(
      'REDACTEDBondDepository',
    )) as REDACTEDBondDepository__factory

    crvBond = await BondFactory.deploy(
      btrfly.address,
      crv.address,
      treasury.address,
      admin.address,
      bondCalculator.address,
      ohmDao.address,
      ohmDao.address,
    )
  })

  it('loads mainnet contracts', async () => {
    const a = await treasury.excessReserves()
    console.log(a)

    const b = crvBond.address
    console.log(b)
  })
})
