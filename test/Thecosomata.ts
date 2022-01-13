/* eslint "prettier/prettier": 0 */
import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BTRFLY, ThecosomataInternal, OlympusERC20Token, SOlympus, OlympusTreasury, SwapRouter, REDACTEDTreasury } from '../typechain';
import { impersonateAddressAndReturnSigner } from '../test2/utils';

describe('Thecosomata', function () {
  let admin: SignerWithAddress;
  let thecosomata: ThecosomataInternal;
  let btrfly: BTRFLY;
  let ohm: OlympusERC20Token;
  let sOhm: SOlympus;
  let ohmTreasury: OlympusTreasury;
  let swapRouter: SwapRouter;
  let redactedTreasury: REDACTEDTreasury;

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
    const REDACTEDTreasury = await ethers.getContractFactory('REDACTEDTreasury');
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
      ohm.address,
      sOhm.address,
      admin.address, // placeholder for bond contract, not used here
      0,
      0,
      0,
      0
    );
    thecosomata = await Thecosomata.deploy(
      btrfly.address,
      sushiV2FactoryAddr,
      ohm.address,
      sOhm.address,
      ohmTreasury.address,
      redactedTreasury.address,
      sushiV2RouterAddr,
    );

    // Mint some test tokens for testing
    const ohmMintTx = await ohm.mint(swapRouter.address, (5e9).toString());
    await ohmMintTx.wait();
    const sOhmMintTx = await sOhm.mint(redactedTreasury.address, (5e9).toString());
    await sOhmMintTx.wait();
    const btrflyMintTx = await btrfly.mint(swapRouter.address, (5e9).toString());
    await btrflyMintTx.wait();

    const unfreezeBtrflyTx = await btrfly.unFreezeToken();
    await unfreezeBtrflyTx.wait();

    // Create and initialize the starting ratio between OHM and BTRFLY (5:1 for testing purpose)
    const initPairTx = await swapRouter.init(ohm.address, btrfly.address, (5e9).toString(), (1e9).toString(), admin.address);
    await initPairTx.wait();

    // Give permission to thecosomata contract for reserve-management permission (ENUM #3)
    const queueManagerPermissionTx = await redactedTreasury.queue(3, thecosomata.address);
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
      // Mint some BTRFLY for the test
      const btrflyMintTx = await btrfly.mint(thecosomata.address, (1e9).toString());
      await btrflyMintTx.wait();

      const [upkeepNeeded] = await thecosomata.checkUpkeep(new Uint8Array());

      expect(upkeepNeeded).to.equal(true);
    });
  });

  describe('calculateOHMAmountRequiredForLP', () => {
    it('Should calculate the amount of OHM required for pairing with the BTRFLY balance', async () => {
      const ohm = (
        await thecosomata._calculateOHMAmountRequiredForLP()
      ).toNumber();

      expect(ohm.valueOf()).to.be.greaterThan(0);

      // TO DO: Verify by successfully adding liquidity
    });
  });
});
