import { expect } from "chai"
import { ethers } from "hardhat"

import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import { 
    impersonateAddressAndReturnSigner,
    mineBlocks,
    getTREASURY,
    getBondingCalculator
} from "./utils"

import {
    TREASURY_ADDRESS,
    LP_TOKEN_ADDRESS,
    BTRFLY_ADDRESS,
    ZERO_ADDRESS,
    BONDING_CALCULATOR
} from "./constants"

import { 
    REDACTEDTreasury, 
    REDACTEDLPBondDepositoryRewardBased,
    IERC20
} from "../typechain"

import { BigNumber } from "ethers";

const TREASURY_OWNER    = "0x20B92862dcb9976E0AA11fAE766343B7317aB349"
const LP_WHALE          = "0x424be8df5db7b04b1063bd4ee0f99db445c59624"

const BCV               = "55"
const VESTING           = "33110"
const MINPRICE          = "16000"
const MAXPAYOUT         = "100"
const FEE               = "9500"
const MAXDEBT           = ethers.utils.parseEther("10000000000000000000000000000")
const TITHE             = "500"
const INITIALDEBT       = "0"


describe("Live LP bonds", function(){

    let dao                 : SignerWithAddress
    let olympusDao          : SignerWithAddress
    let recipient           : SignerWithAddress

    let treasuryOwner       : SignerWithAddress

    let treasuryContract    : REDACTEDTreasury
    let lpToken             : IERC20
    let btrfly              : IERC20
    let ohm                 : IERC20
    let lpBond              : REDACTEDLPBondDepositoryRewardBased
    let lpWhale             : SignerWithAddress

    beforeEach( async function(){

        [dao, olympusDao, recipient] = await ethers.getSigners()

        //impersonate Treasury owner and whale
        treasuryOwner = await impersonateAddressAndReturnSigner(dao,TREASURY_OWNER)
        lpWhale       = await impersonateAddressAndReturnSigner(dao,LP_WHALE)

        btrfly              = (await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", 
            BTRFLY_ADDRESS)) as IERC20

        lpToken              = (await ethers.getContractAt(
                "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", 
                LP_TOKEN_ADDRESS)) as IERC20

        //get Treasury contract
        const treasuryContract = await ethers.getContractAt(
            "REDACTEDTreasury",
            TREASURY_ADDRESS,
            treasuryOwner
            )
        
        const lpTokenFloor = await treasuryContract.getFloor(LP_TOKEN_ADDRESS);

        console.log(lpTokenFloor);

        // set LP token floor to 1B if it is 0
        if ( lpTokenFloor.eq(BigNumber.from(0)) ){

            await treasuryContract.setFloor(
                LP_TOKEN_ADDRESS,
                BigNumber.from("1000000000")
                )

        }

        const NewBondingCalculator = await ethers.getContractFactory("BtrflyOhmBondingCalculator");
        const newbondingCalculator = await NewBondingCalculator.deploy(BTRFLY_ADDRESS);

        console.log("Reset LP")

        /**await treasuryContract.queue(
            BigNumber.from(5),
            LP_TOKEN_ADDRESS
        )

        await treasuryContract.toggle(
            BigNumber.from(5),
            LP_TOKEN_ADDRESS,
            ZERO_ADDRESS
        )**/

        if ( await treasuryContract.bondCalculator(LP_TOKEN_ADDRESS) == ZERO_ADDRESS){

            await treasuryContract.queue(
                BigNumber.from(5),
                LP_TOKEN_ADDRESS
            )
    
            await treasuryContract.toggle(
                BigNumber.from(5),
                LP_TOKEN_ADDRESS,
                newbondingCalculator.address
            )

        }

        // deploy LPbonds
        const LPBond = await ethers.getContractFactory("REDACTEDLPBondDepositoryRewardBased")

        lpBond = await LPBond.deploy(
            BTRFLY_ADDRESS,
            LP_TOKEN_ADDRESS,
            TREASURY_ADDRESS,
            dao.address,
            newbondingCalculator.address,
            olympusDao.address,
            olympusDao.address
        )

        await lpBond.deployed()

        // Add LPbonds as LP depositor (INITIALISE FIRST IN PROD PLS FS - SO WE CAN VERIFY VARS FIRST)

        await treasuryContract.queue(
            BigNumber.from(8),
            lpBond.address
        )

        await treasuryContract.toggle(
            BigNumber.from(8),
            lpBond.address,
            ZERO_ADDRESS
        )

    })

    it(`MinPrice of ${MINPRICE} gives [Zeus] a discount between 10% & 20% out the gate`, async function(){

        await lpBond.initializeBondTerms(
            BCV,
            VESTING,
            MINPRICE,
            MAXPAYOUT,
            FEE,
            MAXDEBT,
            TITHE,
            INITIALDEBT
        )

        await lpToken.connect(lpWhale).approve(
            lpBond.address,
            ethers.constants.MaxUint256
        )

        const lpBtrflyBalance = await btrfly.balanceOf(LP_TOKEN_ADDRESS)

        const lpSupply = await lpToken.totalSupply();

        const lpWhaleDepositBtrflyValue = BigNumber.
        from(2).mul(lpBtrflyBalance).mul(ethers.utils.parseUnits('1','gwei')).div(lpSupply)

        const redemptionMinValue = lpWhaleDepositBtrflyValue.
        mul(BigNumber.from(110)).div(BigNumber.from(100))

        const redemptionMaxValue = lpWhaleDepositBtrflyValue.
        mul(BigNumber.from(120)).div(BigNumber.from(100))

        console.log('DEPOSIT VALUE : ' + lpWhaleDepositBtrflyValue.toString())
        console.log('MIN VALUE TO SATISFY REQ : ' + redemptionMinValue.toString())
        console.log('MAX VALUE TO SATISFY REQ : ' + redemptionMaxValue.toString())

        await lpBond.connect(lpWhale).deposit(
            ethers.utils.parseUnits('1','gwei'),
            BigNumber.from(30000),
            recipient.address
        )

        await mineBlocks(34000);

        await lpBond.connect(recipient).redeem(recipient.address,false);

        const redemptionAmount = await btrfly.balanceOf(recipient.address)

        console.log('REDEMPTION VALUE : ' + redemptionAmount.toString())

        expect(redemptionAmount.toNumber()).is.greaterThan(redemptionMinValue.toNumber());
        expect(redemptionAmount.toNumber()).is.lessThan(redemptionMaxValue.toNumber());

    });

    it("Pays correct fees to Olympus DAO", async function(){

        await lpBond.initializeBondTerms(
            BCV,
            VESTING,
            MINPRICE,
            MAXPAYOUT,
            FEE,
            MAXDEBT,
            TITHE,
            INITIALDEBT
        )

        await lpToken.connect(lpWhale).approve(
            lpBond.address,
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

    })

})