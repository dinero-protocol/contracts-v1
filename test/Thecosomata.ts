/* eslint "prettier/prettier": 0 */
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { BTRFLY, Thecosomata } from '../typechain';
import { getBTRFLY } from '../test2/utils';

describe('Thecosomata', function () {
  let thecosomata: Thecosomata;
  let btrfly: BTRFLY;

  before(async () => {
    const btrflyAddr: string = '0xC0d4Ceb216B3BA9C3701B291766fDCbA977ceC3A';
    const sushiV2FactoryAddr: string =
      '0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac';
    const ohmAddr: string = '0x64aa3364F17a4D01c6f1751Fd97C2BD3D7e7f1D5';

    const Thecosomata = await ethers.getContractFactory('Thecosomata');

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
  });
});
