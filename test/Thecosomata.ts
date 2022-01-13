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

    // NOTE: We are using ThecosomataInternal in order to test internal methods
    const Thecosomata = await ethers.getContractFactory('ThecosomataInternal');

    [admin] = await ethers.getSigners();
    thecosomata = await Thecosomata.deploy(
      btrflyAddr,
      sushiV2FactoryAddr,
      ohmAddr
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
        '0x9e3421274fb4053a83917d62bd368332e9e71fe0' // Replace with address with BTRFLY balance if needed
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
      const ohm = (await thecosomata._calculateOHMAmountRequiredForLP()).toNumber();

      expect(ohm.valueOf()).to.be.greaterThan(0);

      // TO DO: Verify by successfully adding liquidity
    });
  });
});
