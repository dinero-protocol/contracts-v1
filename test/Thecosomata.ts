/* eslint "prettier/prettier": 0 */
import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BTRFLY, ThecosomataInternal } from '../typechain';
import { getBTRFLY, impersonateAddressAndReturnSigner } from '../test2/utils';

describe('Thecosomata', function () {
  let admin: SignerWithAddress;
  let thecosomata: ThecosomataInternal;
  let btrfly: BTRFLY;

  before(async () => {
    const btrflyAddr: string = '0xC0d4Ceb216B3BA9C3701B291766fDCbA977ceC3A';
    const sushiV2FactoryAddr: string =
      '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac';
    const ohmAddr: string = '0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5';
    const sOhmAddr: string = '0x04906695D6D12CF5459975d7C3C03356E4Ccd460';
    const olympusTreasury: string =
      '0x9a315bdf513367c0377fb36545857d12e85813ef';
    const redactedTreasury: string =
      '0x086C98855dF3C78C6b481b6e1D47BeF42E9aC36B';
    const sushiRouter: string = '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f';

    // NOTE: We are using ThecosomataInternal in order to test internal methods
    const Thecosomata = await ethers.getContractFactory('ThecosomataInternal');

    [admin] = await ethers.getSigners();
    thecosomata = await Thecosomata.deploy(
      btrflyAddr,
      sushiV2FactoryAddr,
      ohmAddr,
      sOhmAddr,
      olympusTreasury,
      redactedTreasury,
      sushiRouter
    );
    btrfly = await getBTRFLY(btrflyAddr);
  });

  describe('checkUpkeep', () => {
    it('Should not request upkeep if BTRFLY balance is 0', async () => {
      const btrflyBalance = await btrfly.balanceOf(thecosomata.address);
      const [upkeepNeeded] = await thecosomata.checkUpkeep(new Uint8Array());

      expect(btrflyBalance).to.equal(0);
      expect(upkeepNeeded).to.equal(false);
    });

    it('Should request upkeep if BTRFLY balance is above 0', async () => {
      // List of BTRFLY holders
      // https://etherscan.io/token/0xC0d4Ceb216B3BA9C3701B291766fDCbA977ceC3A#balances
      // Quick and dirty method of getting BTRFLY to Thecosomata
      const btrflyDonor = await impersonateAddressAndReturnSigner(
        admin,
        '0x55b2d13031eb53831e3bb30a67f8d810e85a3d45' // Replace with address with BTRFLY balance if needed
      );

      await btrfly
        .connect(btrflyDonor)
        .transfer(thecosomata.address, (1e9).toString());

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
