/* eslint "prettier/prettier": 0 */
import { ethers } from "hardhat";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import {
  BTRFLY,
  ThecosomataInternal,
  OlympusERC20Token,
  SOlympus,
  OlympusTreasury,
  SwapRouter,
  REDACTEDTreasury,
  OlympusStaking,
} from "../typechain";
import { Result } from "ethers/lib/utils";

describe("Thecosomata", function () {
  let admin: SignerWithAddress;
  let simp: SignerWithAddress;
  let thecosomata: ThecosomataInternal;
  let btrfly: BTRFLY;
  let ohm: OlympusERC20Token;
  let sOhm: SOlympus;
  let ohmTreasury: OlympusTreasury;
  let swapRouter: SwapRouter;
  let redactedTreasury: REDACTEDTreasury;
  let ohmStaking: OlympusStaking;

  const ohmMintForRouter: number = 10e18;
  const sOhmMintForAdmin: number = 200e18;
  const ohmMintForStaking: number = 300e18;
  const redactedTreasuryOhmFloor = 5e9;
  const redactedTreasurySOhmFloor = 5e9;
  const redactedTreasurySOhmDeposit = 100e18;
  const adminBtrflyReceivedForSOhmDeposit: number = 10e9;
  const olympusTreasuryDebtLimit: number = redactedTreasurySOhmDeposit / 4;
  const swapRouterBtrflyLiquidity: number = 1e9;
  const swapRouterOhmLiquidity: number = 5e18;
  const debtFee: number = 5000;
  let sOhmWithdrawalAmount: BigNumber;

  before(async () => {
    const sushiV2FactoryAddr: string =
      "0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac";
    const sushiV2RouterAddr: string =
      "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f";

    const OHM = await ethers.getContractFactory("OlympusERC20Token");
    const SOHM = await ethers.getContractFactory("SOlympus");
    const BTRFLY = await ethers.getContractFactory("BTRFLY");
    const OHMTreasury = await ethers.getContractFactory("OlympusTreasury");
    const OlympusStaking = await ethers.getContractFactory("OlympusStaking");
    const SwapRouter = await ethers.getContractFactory("SwapRouter");
    const REDACTEDTreasury = await ethers.getContractFactory(
      "REDACTEDTreasury"
    );
    // NOTE: We are using ThecosomataInternal in order to test internal methods
    const Thecosomata = await ethers.getContractFactory("ThecosomataInternal");

    [admin, simp] = await ethers.getSigners();

    ohm = await OHM.deploy();
    sOhm = await SOHM.deploy();
    ohmTreasury = await OHMTreasury.deploy(ohm.address, sOhm.address);
    ohmStaking = await OlympusStaking.deploy(ohm.address, sOhm.address);
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
      sushiV2RouterAddr,
      ohmStaking.address,
      debtFee
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
    const ohmStakingMintTx = await ohm.mint(
      ohmStaking.address,
      ohmMintForStaking.toString()
    );
    await ohmStakingMintTx.wait();

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
      swapRouterBtrflyLiquidity.toString() // TO DO: Set as variable (awaiting answer)
    );
    await sendBtrflyToRouterTx.wait();

    // Create and initialize the starting ratio between OHM and BTRFLY (5:1 for testing purpose)
    const initPairTx = await swapRouter.init(
      ohm.address,
      btrfly.address,
      swapRouterOhmLiquidity.toString(), // TO DO: Set as variable (awaiting answer)
      swapRouterBtrflyLiquidity.toString(), // TO DO: Set as variable (awaiting answer)
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

  describe("checkUpkeep", () => {
    it("Should not request upkeep if BTRFLY balance is 0", async () => {
      const btrflyBalance = await btrfly.balanceOf(thecosomata.address);
      const [upkeepNeeded] = await thecosomata.checkUpkeep(new Uint8Array());

      expect(btrflyBalance).to.equal(0);
      expect(upkeepNeeded).to.equal(false);
    });

    it("Should request upkeep if BTRFLY balance is above 0", async () => {
      const sendBtrflyTx = await btrfly.transfer(
        thecosomata.address,
        (1e9).toString()
      );
      await sendBtrflyTx.wait();

      const [upkeepNeeded] = await thecosomata.checkUpkeep(new Uint8Array());

      expect(upkeepNeeded).to.equal(true);
    });
  });

  describe("calculateAmountRequiredForLP", () => {
    it("Should calculate the amount of OHM required for pairing with the BTRFLY balance", async () => {
      const ohm: BigNumber = await thecosomata._calculateAmountRequiredForLP(
        await btrfly.balanceOf(thecosomata.address),
        true
      );

      expect(ohm.gt(0)).to.equal(true);
    });
  });

  describe("withdrawSOHMFromTreasury", () => {
    it("Should withdraw sOHM from the Redacted treasury", async () => {
      // Check sOHM balance of Redacted treasury before withdraw
      const redactedBalanceBeforeWithdrawal: BigNumber = await sOhm.balanceOf(
        redactedTreasury.address
      );
      // Check sOHM balance of Thecosomata before withdraw
      const thecosomataBalanceBeforeWithdrawal: BigNumber =
        await sOhm.balanceOf(thecosomata.address);
      sOhmWithdrawalAmount = await thecosomata._calculateAmountRequiredForLP(
        await btrfly.balanceOf(thecosomata.address),
        true
      );

      // Withdraw sOHM to Thecosomata
      await thecosomata._withdrawSOHMFromTreasury(sOhmWithdrawalAmount);

      // Check sOHM balance of Redacted treasury after withdraw
      const redactedBalanceAfterWithdrawal: BigNumber = await sOhm.balanceOf(
        redactedTreasury.address
      );
      // Check sOHM balance of Thecosomata after withdraw
      const thecosomataBalanceAfterWithdrawal: BigNumber = await sOhm.balanceOf(
        thecosomata.address
      );

      expect(
        redactedBalanceBeforeWithdrawal.eq(
          ethers.BigNumber.from(`${redactedTreasurySOhmDeposit}`)
        )
      ).to.equal(true);
      expect(thecosomataBalanceBeforeWithdrawal.eq(0)).to.equal(true);
      expect(
        redactedBalanceAfterWithdrawal.eq(
          redactedBalanceBeforeWithdrawal.sub(sOhmWithdrawalAmount)
        )
      ).to.equal(true);
      expect(
        thecosomataBalanceAfterWithdrawal.eq(sOhmWithdrawalAmount)
      ).to.equal(true);
    });
  });

  describe("incurOlympusDebt", () => {
    it("Should use sOHM balance as collateral to borrow OHM", async () => {
      const sOhmBalanceBeforeBorrow: BigNumber = await sOhm.balanceOf(
        thecosomata.address
      );
      const ohmBalanceBeforeBorrow: BigNumber = await ohm.balanceOf(
        thecosomata.address
      );

      await thecosomata._incurOlympusDebt(sOhmWithdrawalAmount);

      const sOhmBalanceAfterBorrow: BigNumber = await sOhm.balanceOf(
        thecosomata.address
      );
      const ohmBalanceAfterBorrow: BigNumber = await ohm.balanceOf(
        thecosomata.address
      );

      // Borrowing OHM from Olympus does not change sOHM balance
      expect(sOhmBalanceBeforeBorrow.eq(sOhmWithdrawalAmount)).to.equal(true);
      expect(sOhmBalanceAfterBorrow.eq(sOhmWithdrawalAmount)).to.equal(true);
      expect(ohmBalanceBeforeBorrow).to.equal(0);
      expect(ohmBalanceAfterBorrow.eq(sOhmWithdrawalAmount)).to.equal(true);
    });
  });

  describe("addOHMBTRFLYLiquiditySushiSwap", () => {
    it("Should add OHM-BTRFLY to the LP and transfer the LP tokens", async () => {
      const btrflyBalance = await btrfly.balanceOf(thecosomata.address);
      const transferLPTokens = await (
        await thecosomata._addOHMBTRFLYLiquiditySushiSwap(
          await thecosomata._calculateAmountRequiredForLP(btrflyBalance, true),
          btrflyBalance
        )
      ).wait();
      const transferLPTokensEventArgs: any =
        transferLPTokens.events &&
        transferLPTokens.events[transferLPTokens.events.length - 1].args;
      const olympusFee: BigNumber =
        transferLPTokensEventArgs && transferLPTokensEventArgs.olympusFee;
      const redactedDeposit: BigNumber =
        transferLPTokensEventArgs && transferLPTokensEventArgs.redactedDeposit;

      expect(olympusFee.gt(0)).to.be.equal(true);
      expect(redactedDeposit.gt(0)).to.be.equal(true);
      expect(
        olympusFee.add(redactedDeposit).mul(5000).div(1000000).toNumber()
      ).to.equal(olympusFee);
    });
  });

  describe("setDebtFee", () => {
    it("Should change the debt fee", async () => {
      const newDebtFee: number = 1;
      const debtFeeBeforeChange: BigNumber = await thecosomata.debtFee();
      const setDebtFeeResponse = await (
        await thecosomata.setDebtFee(newDebtFee)
      ).wait();
      const [debtFeeAfterChange]: Result = ethers.utils.defaultAbiCoder.decode(
        ["uint256"],
        setDebtFeeResponse.logs[0].data
      );

      expect(debtFeeBeforeChange.eq(debtFee)).to.equal(true);
      expect(debtFeeAfterChange.eq(newDebtFee)).to.equal(true);
    });

    it("Should only be callable by the owner", async () => {
      await expect(thecosomata.connect(simp).setDebtFee(1)).to.be.reverted;
    });
  });

  describe("getRemainingUnstakeableSOHM", () => {
    it("Should return the correct amount of sOHM available to unstake", async () => {
      const sOHMReservedForOlympus: number = olympusTreasuryDebtLimit * 2;
      const redactedTreasurySOHMBalance: BigNumber = await sOhm.balanceOf(
        redactedTreasury.address
      );
      const thecosomataSOHMBalance: BigNumber = await sOhm.balanceOf(
        thecosomata.address
      );
      const availableSOHMToUnstake = redactedTreasurySOHMBalance
        .add(thecosomataSOHMBalance)
        .sub(ethers.BigNumber.from(`${sOHMReservedForOlympus}`));
      const unstakeableSOHM: BigNumber =
        await thecosomata._getRemainingUnstakeableSOHM();

      expect(availableSOHMToUnstake).to.equal(unstakeableSOHM);
    });
  });

  describe("performUpkeep", () => {
    it("Should add liquidity using borrowed OHM if performUpkeep(true)", async () => {
      await btrfly.transfer(thecosomata.address, (1e9).toString());

      await thecosomata.performUpkeep(
        ethers.utils.defaultAbiCoder.encode(["bool"], [true])
      );
    });

    it("Should add liquidity using unstaked sOHM if performUpkeep(false)", async () => {
      await btrfly.transfer(thecosomata.address, (1e9).toString());

      await thecosomata.performUpkeep(
        ethers.utils.defaultAbiCoder.encode(["bool"], [false])
      );
    });
  });

  describe("addLiquidity - borrow", () => {
    it("Should only borrow up to the debt capacity and burn leftover BTRFLY", async () => {
      // There should be about 15 OHM left worth of debt
      // We add 5 OHM per 1 BTRFLY worth of liquidity
      // Transferring 4 BTRFLY should result in debt capacity being reached
      await btrfly.transfer(thecosomata.address, `${4e9}`);

      const debtCapacity = await thecosomata._getRemainingDebtCapacity();
      const { events } = await (await thecosomata._addLiquidity(true)).wait();
      const borrowAndAddLiquidityEventArgs: any =
        events && events[events.length - 1].args;
      const { capacityBefore, capacityAfter, btrflyBurned } =
        borrowAndAddLiquidityEventArgs;
      const ohmBalance = await ohm.balanceOf(thecosomata.address);
      const btrflyBalance = await btrfly.balanceOf(thecosomata.address);

      expect(capacityBefore).to.equal(debtCapacity);
      expect(capacityAfter.eq(0)).to.equal(true);
      expect(btrflyBurned.div(1e9).eq(1)).to.equal(
        true
      );
      expect(ohmBalance.eq(0)).to.equal(true);
      expect(btrflyBalance.eq(0)).to.equal(true);
    });
  });

  describe("addLiquidity - unstake", () => {
    it("Should withdraw, unstake, and add liquidity without affecting debt capacity", async () => {
      const btrflyTransfer = 1e9;
      await btrfly.transfer(thecosomata.address, btrflyTransfer);

      const ohmRequired = await thecosomata._calculateAmountRequiredForLP(
        btrflyTransfer,
        true
      );

      // Check whether debt capacity is affected by unstaking
      const debtCapacityBefore = await thecosomata._getRemainingDebtCapacity();
      const { events } = await (await thecosomata._addLiquidity(false)).wait();
      const debtCapacityAfter = await thecosomata._getRemainingDebtCapacity();
      const unstakeAndAddLiquidityEventArgs: any =
        events && events[events.length - 1].args;
      const {
        ohmLiquidity,
        btrflyLiquidity,
        capacityBefore,
        capacityAfter,
        btrflyBurned,
      } = unstakeAndAddLiquidityEventArgs;

      expect(ohmRequired).to.equal(ohmLiquidity);
      expect(btrflyLiquidity.eq(btrflyTransfer)).to.equal(true);
      expect(debtCapacityBefore).to.equal(debtCapacityAfter);
      expect(capacityBefore.gt(capacityAfter)).to.equal(true);
      expect(btrflyBurned.eq(0)).to.equal(true);
    });
  });
});
