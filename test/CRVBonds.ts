import { expect } from "chai"
import { ethers } from "hardhat"

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { 
    impersonateAddressAndReturnSigner,
    mineBlocks
} from "./utils"

import {
    TREASURY_ADDRESS,
    CRV_ADDRESS,
    BTRFLY_ADDRESS,
    MULTISIG_ADDRESS,
    ZERO_ADDRESS
} from "./constants"

import { 
    REDACTEDTreasury, 
    REDACTEDBondDepositoryRewardBased,
    IERC20
} from "../typechain"

import { BigNumber } from "ethers";

const BCV               = "285"
const VESTING           = "33110"
const MINPRICE          = "176000"
const MAXPAYOUT         = "100"
const FEE               = "9500"
const MAXDEBT           = ethers.utils.parseEther("10000000000000000000000000000")
const TITHE             = "500"
const INITIALDEBT       = "0"

const crvValueUSD       = BigNumber.from(486)
const btrflyValueUSD    = BigNumber.from(225065)

const CRV_WHALE = "0x7a16ff8270133f063aab6c9977183d9e72835428"

describe("Live CRV bonds", function(){

    let dao                 : SignerWithAddress
    let olympusDao          : SignerWithAddress
    let recipient           : SignerWithAddress

    let treasuryOwner       : SignerWithAddress

    let treasuryContract    : REDACTEDTreasury
    let lpToken             : IERC20
    let btrfly              : IERC20
    let crv                 : IERC20
    let crvBond             : REDACTEDBondDepositoryRewardBased
    let crvWhale             : SignerWithAddress


    beforeEach( async function(){

        [dao, olympusDao, recipient] = await ethers.getSigners()

        //impersonate Treasury owner and whale
        treasuryOwner = await impersonateAddressAndReturnSigner(dao,MULTISIG_ADDRESS)
        crvWhale       = await impersonateAddressAndReturnSigner(dao,CRV_WHALE)

        btrfly              = (await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", 
            BTRFLY_ADDRESS)) as IERC20

        crv             = (await ethers.getContractAt(
                "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", 
                CRV_ADDRESS)) as IERC20

        //get Treasury contract
        const treasuryContract = await ethers.getContractAt(
            "REDACTEDTreasury",
            TREASURY_ADDRESS,
            treasuryOwner
            )


        // deploy LPbonds
        const CRVBond = await ethers.getContractFactory("REDACTEDBondDepositoryRewardBased")

        crvBond = await CRVBond.deploy(
            BTRFLY_ADDRESS,
            CRV_ADDRESS,
            TREASURY_ADDRESS,
            dao.address,
            ZERO_ADDRESS,
            olympusDao.address,
            olympusDao.address
        )

        await crvBond.deployed()

        // Add LPbonds as LP depositor (INITIALISE FIRST IN PROD PLS FS - SO WE CAN VERIFY VARS FIRST)

        await treasuryContract.queue(
            BigNumber.from(8),
            crvBond.address
        )

        await treasuryContract.toggle(
            BigNumber.from(8),
            crvBond.address,
            ZERO_ADDRESS
        )

    })

    it(`MinPrice of ${MINPRICE} gives [Zeus] a ROI between 5% & 10% out the gate`, async function(){

        await crvBond.initializeBondTerms(
            BCV,
            VESTING,
            MINPRICE,
            MAXPAYOUT,
            FEE,
            MAXDEBT,
            TITHE,
            INITIALDEBT
        )

        await crv.connect(crvWhale).approve(
            crvBond.address,
            ethers.constants.MaxUint256
        )

        const crvDepositBtrflyValue = 
        (ethers.utils.parseUnits('1000','gwei')).mul(crvValueUSD).div(btrflyValueUSD)

        const redemptionMinValue = crvDepositBtrflyValue.
        mul(BigNumber.from(105)).div(BigNumber.from(100))

        const redemptionMaxValue = crvDepositBtrflyValue.
        mul(BigNumber.from(110)).div(BigNumber.from(100))

        console.log('DEPOSIT VALUE : ' + crvDepositBtrflyValue.toString())
        console.log('MIN VALUE TO SATISFY REQ : ' + redemptionMinValue.toString())
        console.log('MAX VALUE TO SATISFY REQ : ' + redemptionMaxValue.toString())

        await crvBond.connect(crvWhale).deposit(
            ethers.utils.parseUnits('1000','ether'),
            BigNumber.from(300000),
            recipient.address
        )

        await mineBlocks(34000);

        await crvBond.connect(recipient).redeem(recipient.address,false);

        const redemptionAmount = await btrfly.balanceOf(recipient.address)

        console.log('REDEMPTION VALUE : ' + redemptionAmount.toString())

        expect(redemptionAmount.toNumber()).is.greaterThan(redemptionMinValue.toNumber());
        expect(redemptionAmount.toNumber()).is.lessThan(redemptionMaxValue.toNumber());

    });

    /**it("Pays correct fees to Olympus DAO", async function(){

        await crvBond.initializeBondTerms(
            BCV,
            VESTING,
            MINPRICE,
            MAXPAYOUT,
            FEE,
            MAXDEBT,
            TITHE,
            INITIALDEBT
        )

        await crv.connect(crvWhale).approve(
            crvBond.address,
            ethers.constants.MaxUint256
        )

        await lpBond.connect(lpWhale).deposit(
            ethers.utils.parseUnits('1','gwei'),
            BigNumber.from(30000),
            recipient.address
        )

        await mineBlocks(34000);

        await lpBond.connect(recipient).redeem(recipient.address,false);

        const ohmBalance = await lpToken.balanceOf(olympusDao.address)
        expect(Number(ethers.utils.formatEther(ohmBalance))).to.be.greaterThan(0)
        console.log('ohm dao balance', ethers.utils.formatEther(ohmBalance))

        const ohmBtrflyBalance = await btrfly.balanceOf(olympusDao.address)
        expect(Number(ethers.utils.formatEther(ohmBtrflyBalance))).to.be.greaterThan(0)
        console.log('ohm dao balance', ethers.utils.formatEther(ohmBtrflyBalance))

    })**/

})