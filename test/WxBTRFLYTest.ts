import { expect } from "chai"
import { ethers, network } from "hardhat"
import * as dotenv from 'dotenv'

import { 
    impersonateAddressAndReturnSigner,
    mineBlocks,
    getTREASURY,
    getBondingCalculator
} from "./utils"

import {
    BTRFLY_ADDRESS,
    XBTRFLY_ADDRESS,
    STAKING_ADDRESS,
    TREASURY_ADDRESS,
    MULTISIG_ADDRESS,
    ZERO_ADDRESS
} from "./constants"

import { 
    WxBTRFLY,
    XBTRFLY,
    REDACTEDStaking,
    REDACTEDTreasury,
    IERC20
} from "../typechain"

import { BigNumber } from "ethers";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

// Test setup
// - fetch existing protocol
// - deploy wxbtrfly

// Tests if we had less time pressure
// - deploy protocol "correctly"
// - compare existing implementation with fix with "correct implementation"

// Test wrapping
// --> wrap and unwrap BTRFLY doesn't result in change to balance
// --> wrap and unwrap xBTRFLY doesn't result in change to balance

// check that xBTRFLYvalue & wBTRFLYvalue correspond with values returned by token contract

// do test where 3 addresses all have 1000 btrfly, and they all stake
// --> 1 via wrapFromBTRFLY
// --> 1 via wrapFromxBTRFLY
// --> 1 held as xBTRFLY
// Wait 1 epoch MAKE SURE ALL CONVERT INTO THE SAME NUMBER OF BTRFLY

// Test compounding yield
// --> wrap, wait one epoch, rebase and unwrap results in gains expected
// --> read index, wait one epoch, rebase and expect realIndex to increase by the right amount

describe("wxBTRFLY post-fix", function(){

    let btrfly : IERC20
    let xbtrfly : XBTRFLY
    let wxbtrfly : WxBTRFLY
    let staking : REDACTEDStaking
    let treasury : REDACTEDTreasury

    let multisig : SignerWithAddress
    let simp : SignerWithAddress
    let guy0 : SignerWithAddress
    let guy1 : SignerWithAddress
    let guy2 : SignerWithAddress

    beforeEach( async function(){

        [simp, guy0, guy1, guy2 ] = await ethers.getSigners()

        multisig = await impersonateAddressAndReturnSigner(simp,MULTISIG_ADDRESS)

        btrfly = await ethers.getContractAt("BTRFLY",BTRFLY_ADDRESS)

        xbtrfly = await ethers.getContractAt("xBTRFLY",XBTRFLY_ADDRESS) as XBTRFLY;

        staking = await ethers.getContractAt("REDACTEDStaking", STAKING_ADDRESS)

        treasury = await ethers.getContractAt("REDACTEDTreasury", TREASURY_ADDRESS, multisig)

        const WxBTRFLYFactory = await ethers.getContractFactory("wxBTRFLY")

        wxbtrfly = await WxBTRFLYFactory.deploy(
            STAKING_ADDRESS,
            BTRFLY_ADDRESS,
            XBTRFLY_ADDRESS
        ) as WxBTRFLY

        await wxbtrfly.deployed()

        console.log(" wxbtrfly deployed ")

        //mint rewards to addreses for testing
        await treasury.queue('8',MULTISIG_ADDRESS)
        await treasury.toggle('8',MULTISIG_ADDRESS,ZERO_ADDRESS)
        await treasury.mintRewards(guy0.address,ethers.utils.parseUnits('1000','gwei'))
        await treasury.mintRewards(guy1.address,ethers.utils.parseUnits('1000','gwei'))
        await treasury.mintRewards(guy2.address,ethers.utils.parseUnits('1000','gwei'))

        console.log(" btrfly minted ")

    })

    afterEach( async function(){

        await network.provider.request({
            method: "hardhat_reset",
            params: [
              {
                forking: {
                  jsonRpcUrl: process.env.MAINNET_URL,
                },
              },
            ],
          });

    })

    describe("Immediate Wrap/Unwrap Attack Proof", function(){

        it("Wrap / Unwrap xBTRFLY doesn't result in change in balance", async function(){

            //wrap
            await btrfly.connect(guy0).approve(staking.address,ethers.constants.MaxUint256)
            await staking.connect(guy0).stake(ethers.utils.parseUnits('1000','gwei'), guy0.address);
            await staking.claim(guy0.address);

            const xbtrflyBalance = await xbtrfly.balanceOf(guy0.address);

            await xbtrfly.connect(guy0).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy0).wrapFromxBTRFLY(xbtrflyBalance)
            
            //get balance
            const wbalance = await wxbtrfly.balanceOf(guy0.address)
            console.log(" wbalance = " + wbalance.toString())

            //unwrap
            await wxbtrfly.connect(guy0).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy0).unwrapToxBTRFLY(wbalance)

            const balancePost = await xbtrfly.balanceOf(guy0.address)

            console.log(balancePost);

            expect( 
                balancePost.
                sub(ethers.utils.parseUnits('1000','gwei')).
                abs().
                lte(1)
            )

        })

        it("Wrap / Unwrap BTRFLY doesn't result in change in balance", async function(){

            //wrap
            await btrfly.connect(guy0).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy0).wrapFromBTRFLY(ethers.utils.parseUnits('1000','gwei'))
            
            //get balance
            const wbalance = await wxbtrfly.balanceOf(guy0.address)
            console.log(" wbalance = " + wbalance.toString())

            //unwrap
            await wxbtrfly.connect(guy0).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy0).unwrapToBTRFLY(wbalance)

            const balancePost = await btrfly.balanceOf(guy0.address)

            console.log(balancePost);

            expect( 
                balancePost.
                sub(ethers.utils.parseUnits('1000','gwei')).
                abs().
                lte(1)
            )
            
        })

        it("N units of xBTRFLY and BTRFLY both produce M units of wxBTRFLY", async function(){

            await btrfly.connect(guy0).approve(staking.address,ethers.constants.MaxUint256)
            await staking.connect(guy0).stake(ethers.utils.parseUnits('1000','gwei'), guy0.address);
            await staking.claim(guy0.address);

            const xbtrflyBalance = await xbtrfly.balanceOf(guy0.address);

            await xbtrfly.connect(guy0).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy0).wrapFromxBTRFLY(xbtrflyBalance)
            
            //get balance
            const wbalance0 = await wxbtrfly.balanceOf(guy0.address)

            await btrfly.connect(guy1).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy1).wrapFromBTRFLY(ethers.utils.parseUnits('1000','gwei'))
            
            //get balance
            const wbalance1 = await wxbtrfly.balanceOf(guy0.address)

            expect(wbalance0.eq(wbalance1)).to.equal(true);

        })

        it("N units of wxBTRFLY produce M unit of xBTRFLY & BTRFLY", async function(){

            await btrfly.connect(guy0).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy0).wrapFromBTRFLY(ethers.utils.parseUnits('1000','gwei'))

            expect( (await btrfly.balanceOf(guy0.address)).eq(BigNumber.from(0)) )
            await wxbtrfly.connect(guy0).approve(wxbtrfly.address,ethers.constants.MaxUint256)

            const wBalance = await wxbtrfly.balanceOf(guy0.address)
            console.log(wBalance.toString())
            
            await wxbtrfly.connect(guy0).unwrapToBTRFLY(wBalance.div(2))
            await wxbtrfly.connect(guy0).unwrapToxBTRFLY(wBalance.div(2))

            const xBalance = await xbtrfly.balanceOf(guy0.address)
            console.log(xBalance.toString())

            const balance = await btrfly.balanceOf(guy0.address)
            console.log(balance.toString())

            expect( xBalance.eq(balance) ).to.equal(true)

        })

    })

    describe("One Epoch Yield", function(){

        it("All tokens yield by same amount (exit ALL into xBTRFLY)", async function(){

            //real index pre
            const ri0 = await wxbtrfly.realIndex();
            console.log("real index at t = N : " + ri0.toString())

            //guy0 holds xBTRFLY
            await btrfly.connect(guy0).approve(staking.address,ethers.constants.MaxUint256)
            await staking.connect(guy0).stake(ethers.utils.parseUnits('1000','gwei'), guy0.address);
            await staking.claim(guy0.address);

            //guy1 gets his wxBTRFLY using wrapFromBTRFLY
            await btrfly.connect(guy1).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy1).wrapFromBTRFLY(ethers.utils.parseUnits('1000','gwei'))

            //guy2 gets his wxBTRFLY using wrapFromxBTRFLY
            await btrfly.connect(guy2).approve(staking.address,ethers.constants.MaxUint256)
            await staking.connect(guy2).stake(ethers.utils.parseUnits('1000','gwei'), guy2.address);
            await staking.claim(guy2.address);
            const xbtrflyBalance = await xbtrfly.balanceOf(guy2.address);
            await xbtrfly.connect(guy2).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            await wxbtrfly.connect(guy2).wrapFromxBTRFLY(xbtrflyBalance)

            await mineBlocks(2200);
            await staking.rebase();

            //real index post
            const ri1 = await wxbtrfly.realIndex();
            console.log("real index at t = N + 1 epoch : " + ri1.toString())

            const xb0 = await xbtrfly.balanceOf(guy0.address)
            console.log("b0 = "+xb0.toString())

            const xbwx0 = await xbtrfly.balanceOf(wxbtrfly.address)
            console.log("wx contract balance : " + xbwx0)

            await wxbtrfly.connect(guy1).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            const wb1 = await wxbtrfly.balanceOf(guy1.address)
            const exxb1 = await wxbtrfly.xBTRFLYValue(wb1);
            console.log("expected xb1 = " + exxb1.toString())
            await wxbtrfly.connect(guy1).unwrapToxBTRFLY(wb1)
            const xb1 = await xbtrfly.balanceOf(guy1.address)
            console.log("real xb1 = " + xb1.toString())

            const xbwx1 = await xbtrfly.balanceOf(wxbtrfly.address)
            console.log("wx contract balance : " + xbwx1)

            await wxbtrfly.connect(guy2).approve(wxbtrfly.address,ethers.constants.MaxUint256)
            const wb2 = await wxbtrfly.balanceOf(guy2.address)
            const exxb2 = await wxbtrfly.xBTRFLYValue(wb2);
            console.log("expected xb2 = " + exxb2.toString())
            await wxbtrfly.connect(guy2).unwrapToxBTRFLY(wb2)
            const xb2 = await xbtrfly.balanceOf(guy2.address)
            console.log("real xb2 = " + xb2.toString())
            
            expect(xb1.eq(xb0)).to.equal(true)
            expect(xb2.eq(xb0)).to.equal(true)

        })

    })

})