import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe("Test", function () {
  it("Should test", async function () {
    let admin: SignerWithAddress;
    [admin] = await ethers.getSigners();

    console.log(admin.address);

    /// ////////////////////////////////
    // Deployment and setup sections

    // Deploy all dependencies
    const OlympusAuthority = await ethers.getContractFactory(
      "OlympusAuthority"
    );
    const olympusAuthority = await OlympusAuthority.deploy(
      admin.address,
      admin.address,
      admin.address,
      admin.address
    );
    await olympusAuthority.deployed();

    const OHM = await ethers.getContractFactory("OlympusERC20Token");
    const ohm = await OHM.deploy(olympusAuthority.address);
    await ohm.deployed();

    const OlympusTreasury = await ethers.getContractFactory("OlympusTreasury");
    const olympusTreasury = await OlympusTreasury.deploy(
      ohm.address,
      0,
      olympusAuthority.address
    );
    await olympusTreasury.deployed();

    const setAuthorityTx = await olympusAuthority.pushVault(
      olympusTreasury.address,
      true
    );
    await setAuthorityTx.wait();

    const SOHM = await ethers.getContractFactory("sOlympus");
    const sOhm = await SOHM.deploy();
    await sOhm.deployed();

    const initializeSOhmTx = await sOhm.initialize(
      olympusTreasury.address,
      olympusTreasury.address
    );
    await initializeSOhmTx.wait();

    const BTRFLY = await ethers.getContractFactory("BTRFLY");
    const btrfly = await BTRFLY.deploy();
    await btrfly.deployed();

    const XBTRFLY = await ethers.getContractFactory("xBTRFLY");
    const xBtrfly = await XBTRFLY.deploy();
    await xBtrfly.deployed();

    const REDACTEDTreasury = await ethers.getContractFactory(
      "REDACTEDTreasury"
    );
    const redactedTreasury = await REDACTEDTreasury.deploy(
      btrfly.address,
      ohm.address,
      sOhm.address,
      ohm.address,
      sOhm.address,
      admin.address, // placeholder for bond contract
      0,
      0,
      0,
      0
    );
    await redactedTreasury.deployed();

    const Distributor = await ethers.getContractFactory("Distributor");
    const distributor = await Distributor.deploy(
      redactedTreasury.address,
      btrfly.address,
      20,
      2000
    );
    await distributor.deployed();

    const WETH = await ethers.getContractFactory("WETH9");
    const weth = await WETH.deploy();
    await weth.deployed();

    const LPFactory = await ethers.getContractFactory("UniswapV2Factory");
    const lpFactory = await LPFactory.deploy(admin.address);
    await lpFactory.deployed();

    const SushiRouter = await ethers.getContractFactory("UniswapV2Router02");
    const sushiRouter = await SushiRouter.deploy(
      lpFactory.address,
      weth.address
    );
    await sushiRouter.deployed();

    // Initial setup
    const queueRewardManagerTx = await redactedTreasury.queue(8, admin.address);
    await queueRewardManagerTx.wait();

    const toggleRewardManagerTx = await redactedTreasury.toggle(
      8,
      admin.address,
      admin.address
    );
    await toggleRewardManagerTx.wait();

    const enableSOhmTx = await olympusTreasury.enable(
      9,
      sOhm.address,
      admin.address
    );
    await enableSOhmTx.wait();

    const enablePermissionTx = await olympusTreasury.enable(
      10,
      admin.address,
      admin.address
    );
    await enablePermissionTx.wait();

    /// ////////////////////////////////
    // Test sections

    // Replace admin.address with the address of the Thecosomata contract in order to test the condition where the contract has some $BTRFLY
    const testMintTx = await btrfly.mint(admin.address, "1000000000000");
    await testMintTx.wait();

    const setDebtLimitTx = await olympusTreasury.setDebtLimit(
      admin.address,
      "1000000000000000"
    );
    await setDebtLimitTx.wait();

    // Test incurDebt
    const incurDebtTx = await olympusTreasury.incurDebt(
      "1000000000",
      ohm.address
    );
    await incurDebtTx.wait();
  });
});
