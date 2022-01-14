/* eslint "prettier/prettier": 0 */
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  BTRFLY,
  ThecosomataInternal,
  OlympusERC20Token,
  SOlympus,
  OlympusTreasury,
  SwapRouter,
  REDACTEDTreasury,
} from '../typechain';

describe('Thecosomata', function () {
  let admin: SignerWithAddress;
  let thecosomata: ThecosomataInternal;
  let btrfly: BTRFLY;
  let ohm: OlympusERC20Token;
  let sOhm: SOlympus;
  let ohmTreasury: OlympusTreasury;
  let swapRouter: SwapRouter;
  let redactedTreasury: REDACTEDTreasury;

  const ohmMintForRouter: number = 10e18;
  const sOhmMintForAdmin: number = 200e18;
  const redactedTreasuryOhmFloor = 5e9;
  const redactedTreasurySOhmFloor = 5e9;
  const redactedTreasurySOhmDeposit = 100e18;
  const adminBtrflyReceivedForSOhmDeposit: number = 10e9;
  const olympusTreasuryDebtLimit: number = redactedTreasurySOhmDeposit / 2;

  before(async () => {
    const sushiV2FactoryAddr: string =
      '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac';
    const sushiV2RouterAddr: string =
      '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f';

    const OHM = await ethers.getContractFactory('OlympusERC20Token');
    const SOHM = await ethers.getContractFactory('SOlympus');
    const BTRFLY = await ethers.getContractFactory('BTRFLY');
    const OHMTreasury = await ethers.getContractFactory('OlympusTreasury');
    const SwapRouter = await ethers.getContractFactory('SwapRouter');
    const REDACTEDTreasury = await ethers.getContractFactory(
      'REDACTEDTreasury'
    );
    // NOTE: We are using ThecosomataInternal in order to test internal methods
    const Thecosomata = await ethers.getContractFactory('ThecosomataInternal');

    [admin] = await ethers.getSigners();

    ohm = await OHM.deploy();
    sOhm = await SOHM.deploy();
    ohmTreasury = await OHMTreasury.deploy(ohm.address, sOhm.address);
    btrfly = await BTRFLY.deploy();
    swapRouter = await SwapRouter.deploy(sushiV2RouterAddr, sushiV2FactoryAddr);
    redactedTreasury = await REDACTEDTreasury.deploy(
      btrfly.address,
      ohm.address,
      sOhm.address,
      admin.address, // placeholder for cvx, not used here
      admin.address, // placeholder for crv, not used here
      admin.address, // placeholder for bond, not used here
      redactedTreasuryOhmFloor.toString(), // ohm floor
      0, // cvx floor
      0, // crv floor
      0
    );
    thecosomata = await Thecosomata.deploy(
      btrfly.address,
      sushiV2FactoryAddr,
      ohm.address,
      sOhm.address,
      ohmTreasury.address,
      redactedTreasury.address,
      sushiV2RouterAddr
    );

    const setSOHMFloorTx = await redactedTreasury.setFloor(
      sOhm.address,
      redactedTreasurySOhmFloor.toString()
    );
    await setSOHMFloorTx.wait();

    // Mint some test tokens for testing
    const ohmMintTx = await ohm.mint(
      swapRouter.address,
      ohmMintForRouter.toString()
    );
    await ohmMintTx.wait();
    const sOhmMintTx = await sOhm.mint(
      admin.address,
      sOhmMintForAdmin.toString()
    );
    await sOhmMintTx.wait();

    // Unfreeze btrfly
    const unfreezeBtrflyTx = await btrfly.unFreezeToken();
    await unfreezeBtrflyTx.wait();

    // Deposit some sOHM to mock the treasury reserves as a reserve manager
    const setVaultTx = await btrfly.setVault(redactedTreasury.address);
    await setVaultTx.wait();
    const queueReserveManagerTx = await redactedTreasury.queue(
      0,
      admin.address
    );
    await queueReserveManagerTx.wait();
    const toggleReserveManagerTx = await redactedTreasury.toggle(
      0,
      admin.address,
      admin.address
    );
    await toggleReserveManagerTx.wait();
    const approveDepositTx = await sOhm.approve(
      redactedTreasury.address,
      redactedTreasurySOhmDeposit.toString()
    );
    await approveDepositTx.wait();
    const depositTx = await redactedTreasury.deposit(
      redactedTreasurySOhmDeposit.toString(),
      sOhm.address,
      adminBtrflyReceivedForSOhmDeposit.toString()
    );
    await depositTx.wait();

    const sendBtrflyToRouterTx = await btrfly.transfer(
      swapRouter.address,
      (5e9).toString() // TO DO: Set as variable (awaiting answer)
    );
    await sendBtrflyToRouterTx.wait();

    // Create and initialize the starting ratio between OHM and BTRFLY (5:1 for testing purpose)
    const initPairTx = await swapRouter.init(
      ohm.address,
      btrfly.address,
      (5e18).toString(), // TO DO: Set as variable (awaiting answer)
      (1e9).toString(), // TO DO: Set as variable (awaiting answer)
      admin.address
    );
    await initPairTx.wait();

    // Set debt limit for thecosomata
    const setDebtLimitTx = await ohmTreasury.setDebtLimit(
      thecosomata.address,
      olympusTreasuryDebtLimit.toString()
    );
    await setDebtLimitTx.wait();

    // Give permission to thecosomata contract for reserve-management permission (ENUM #3)
    const queueManagerPermissionTx = await redactedTreasury.queue(
      3,
      thecosomata.address
    );
    await queueManagerPermissionTx.wait();
    const toggleManagerPermissionTx = await redactedTreasury.toggle(
      3,
      thecosomata.address,
      admin.address
    );
    await toggleManagerPermissionTx.wait();
  });

  describe('checkUpkeep', () => {
    it('Should not request upkeep if BTRFLY balance is 0', async () => {
      const btrflyBalance = await btrfly.balanceOf(thecosomata.address);
      const [upkeepNeeded] = await thecosomata.checkUpkeep(new Uint8Array());

      expect(btrflyBalance).to.equal(0);
      expect(upkeepNeeded).to.equal(false);
    });

    it('Should request upkeep if BTRFLY balance is above 0', async () => {
      const sendBtrflyTx = await btrfly.transfer(
        thecosomata.address,
        (1e9).toString()
      );
      await sendBtrflyTx.wait();

      const [upkeepNeeded] = await thecosomata.checkUpkeep(new Uint8Array());

      expect(upkeepNeeded).to.equal(true);
    });
  });

  describe('calculateOHMAmountRequiredForLP', () => {
    it('Should calculate the amount of OHM required for pairing with the BTRFLY balance', async () => {
      const ohm: BigNumber =
        await thecosomata._calculateOHMAmountRequiredForLP();

      expect(ohm.gt(0)).to.equal(true);
    });
  });

  describe('performUpkeep', () => {
    it('Should fully perform up-keep if BTRFLY balance is above 0', async () => {
      // Test the up-keep
      await thecosomata.performUpkeep(new Uint8Array());

      // Check LP-token balance
      const lpBalance = await swapRouter.lpBalance(
        redactedTreasury.address,
        ohm.address,
        btrfly.address
      );
      expect(lpBalance.gt(0)).to.equal(true);
    });
  });
});
