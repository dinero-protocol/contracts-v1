/* eslint "prettier/prettier": 0 */
import { ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BTRFLY, REDACTEDTreasury, ThecosomataETH, CurveHelper } from '../typechain';

describe('ThecosomataETH', function () {
  let admin: SignerWithAddress;
  let simp: SignerWithAddress;
  let thecosomata: ThecosomataETH;
  let btrfly: BTRFLY;
  let redactedTreasury: REDACTEDTreasury;
  let curveHelper: CurveHelper;
  let poolAddress: string;

  const wethForTreasury: BigNumber = ethers.utils.parseUnits('100', 18);
  const wethForHelper: BigNumber = ethers.utils.parseUnits('2', 18);
  const btrflyForTreasury: BigNumber = ethers.utils.parseUnits('1000', 9);
  const btrflyForHelper: BigNumber = ethers.utils.parseUnits('10', 9);
  const btrflyForThecosomata: BigNumber = ethers.utils.parseUnits('10', 9);
  const redactedTreasuryWETHFloor: BigNumber = BigNumber.from(333333);
  const curveDeployerAddress: string = '0xf18056bbd320e96a48e3fbf8bc061322531aac99';
  const wethAddress: string = '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2';

  before(async () => {
    const BTRFLY = await ethers.getContractFactory('BTRFLY');
    const REDACTEDTreasury = await ethers.getContractFactory('REDACTEDTreasury');
    const CurveHelper = await ethers.getContractFactory('CurveHelper');
    const ThecosomataETH = await ethers.getContractFactory('ThecosomataETH');

    [admin, simp] = await ethers.getSigners();

    btrfly = await BTRFLY.deploy();
    curveHelper = await CurveHelper.deploy(curveDeployerAddress, btrfly.address, wethAddress);
    redactedTreasury = await REDACTEDTreasury.deploy(
      btrfly.address,
      btrfly.address, // placeholder for ohm
      btrfly.address, // placeholder for sOhm
      btrfly.address, // placeholder for cvx
      btrfly.address, // placeholder for crv
      btrfly.address, // placeholder for bond
      1, // ohm floor
      1, // cvx floor
      1, // crv floor
      0
    );

    poolAddress = await curveHelper.poolAddress();

    // Set admin as mock minter so we can mint into thecosomata later
    const setVaultTx = await btrfly.setVault(admin.address);
    await setVaultTx.wait();

    // Unfreeze btrfly
    const unfreezeBtrflyTx = await btrfly.unFreezeToken();
    await unfreezeBtrflyTx.wait();

    thecosomata = await ThecosomataETH.deploy(
      btrfly.address,
      wethAddress,
      redactedTreasury.address,
      poolAddress
    );

    // Add WETH as reserve token for the treasury (ENUM #2)
    const queueReserveTokenTx = await redactedTreasury.queue(2, wethAddress);
    await queueReserveTokenTx.wait();
    const toggleReserveTokenTx = await redactedTreasury.toggle(2, wethAddress, admin.address);
    await toggleReserveTokenTx.wait();

    // Set floor for WETH
    const setWETHFloorTx = await redactedTreasury.setFloor(wethAddress, redactedTreasuryWETHFloor);
    await setWETHFloorTx.wait();

    // Give permission to thecosomata contract for reserve-management permission (ENUM #3)
    const queueManagerPermissionTx = await redactedTreasury.queue(3, thecosomata.address);
    await queueManagerPermissionTx.wait();
    const toggleManagerPermissionTx = await redactedTreasury.toggle(
      3,
      thecosomata.address,
      admin.address
    );
    await toggleManagerPermissionTx.wait();

    // Mint some BTRFLY for testing
    const mintBtrflyForTreasuryTx = await btrfly.mint(redactedTreasury.address, btrflyForTreasury);
    await mintBtrflyForTreasuryTx.wait();
    const mintBtrflyForHelperTx = await btrfly.mint(curveHelper.address, btrflyForHelper);
    await mintBtrflyForHelperTx.wait();

    // Mock some WETH for testing
    const wrapForTreasuryTx = await curveHelper.wrapAndTransfer(
      redactedTreasury.address,
      wethForTreasury,
      {
        value: wethForTreasury,
      }
    );
    await wrapForTreasuryTx.wait();
    const wrapForHelperTx = await curveHelper.wrapAndTransfer(curveHelper.address, wethForHelper, {
      value: wethForHelper,
    });
    await wrapForHelperTx.wait();

    // Populate mock reserve
    const auditReserveTx = await redactedTreasury.auditReserves();
    await auditReserveTx.wait();

    // Init pool
    const initPoolTx = await curveHelper.initPool(wethForHelper, btrflyForHelper);
    await initPoolTx.wait();
  });

  describe('checkUpkeep', () => {
    it('Should not request upkeep if BTRFLY balance is 0', async () => {
      const btrflyBalance = await btrfly.balanceOf(thecosomata.address);
      const upkeepNeeded = await thecosomata.checkUpkeep();

      expect(btrflyBalance).to.equal(0);
      expect(upkeepNeeded).to.equal(false);
    });

    it('Should request upkeep if BTRFLY balance is above 0', async () => {
      const mintBtrflyTx = await btrfly.mint(thecosomata.address, btrflyForThecosomata);
      await mintBtrflyTx.wait();

      const upkeepNeeded = await thecosomata.checkUpkeep();

      expect(upkeepNeeded).to.equal(true);
    });
  });

  describe('performUpkeep', () => {
    it("Should add liquidity using the treasury's WETH and available BTRFLY", async () => {
      const treasuryPoolTokenBalanceBeforeUpkeep = await curveHelper.poolTokenBalance(redactedTreasury.address);
      await thecosomata.performUpkeep();
      const treasuryPoolTokenBalanceAfterUpkeep = await curveHelper.poolTokenBalance(redactedTreasury.address);

      expect(treasuryPoolTokenBalanceAfterUpkeep).to.be.gt(treasuryPoolTokenBalanceBeforeUpkeep);
    });
  });

  describe('withdraw', () => {
    it('Should withdraw tokens from Thecosomata', async () => {
      const thecosomataBalanceBeforeTransfer = await btrfly.balanceOf(thecosomata.address);

      const btrflyTransfer = 1e9;
      const mintBtrflyTx = await btrfly.mint(thecosomata.address, btrflyTransfer);
      await mintBtrflyTx.wait();

      const adminBalanceAfterTransfer = await btrfly.balanceOf(admin.address);
      const thecosomataBalanceAfterTransfer = await btrfly.balanceOf(thecosomata.address);

      await thecosomata.withdraw(btrfly.address, btrflyTransfer, admin.address);

      const adminBalanceAfterWithdraw = await btrfly.balanceOf(admin.address);
      const thecosomataBalanceAfterWithdraw = await btrfly.balanceOf(thecosomata.address);

      expect(thecosomataBalanceBeforeTransfer.eq(0)).to.equal(true);
      expect(adminBalanceAfterTransfer.eq(0)).to.equal(true);
      expect(thecosomataBalanceAfterTransfer.eq(1e9)).to.equal(true);
      expect(adminBalanceAfterWithdraw.eq(1e9)).to.equal(true);
      expect(thecosomataBalanceAfterWithdraw.eq(0)).to.equal(true);
    });

    it('Should only be callable by the owner', async () => {
      await expect(
        thecosomata.connect(simp).withdraw(btrfly.address, 1e9, simp.address)
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });
});
