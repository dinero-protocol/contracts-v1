import { BigNumber } from 'ethers'
import { ethers, network } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

export const impersonateAddressAndReturnSigner = async (
  networkAdmin: SignerWithAddress,
  address: string,
) => {
  await ethers.provider.send('hardhat_impersonateAccount', [address]) // get some eth from a miner
  const account = await ethers.getSigner(address)
  await networkAdmin.sendTransaction({
    to: address,
    value: ethers.utils.parseEther('100'),
  })
  return account
}


export async function increaseTime(value: BigNumber) {
  if (!ethers.BigNumber.isBigNumber(value)) {
    value = ethers.BigNumber.from(value)
  }
  await ethers.provider.send('evm_increaseTime', [value.toNumber()])
  await ethers.provider.send('evm_mine', [])
}

// mine a number of blocks
export const mineBlocks = async (numberOfBlocks: number) => {
  const startingBlock = await ethers.provider.getBlockNumber()
  const targetBlock = numberOfBlocks + startingBlock
  let currentBlock = startingBlock
  while (currentBlock < targetBlock) {
    await network.provider.send('evm_mine')
    currentBlock = await ethers.provider.getBlockNumber()
  }
}

export const getBondDepoContract = async (address: string) => {
  const contract = await ethers.getContractAt('REDACTEDBondDepository', address)
  return contract
}

export const getBTRFLY = async (address: string) => {
  const contract = await ethers.getContractAt('BTRFLY', address)
  return contract
}

export const getSTAKING = async (address: string) => {
  const contract = await ethers.getContractAt('REDACTEDStaking', address)
  return contract
}

export const getTREASURY = async (address: string) => {
  const contract = await ethers.getContractAt('REDACTEDTreasury', address)
  return contract
}

export const getStakingHelper = async (address: string) => {
  const contract = await ethers.getContractAt('StakingHelper', address)
  return contract
}

export const getWarmupHelper = async (address: string) => {
  const contract = await ethers.getContractAt('StakingWarmup', address)
  return contract
}

export const getStakingDistributor = async (address: string) => {
  const contract = await ethers.getContractAt('Distributor', address)
  return contract
}

export const getBondingCalculator = async (address: string) => {
  const contract = await ethers.getContractAt('REDACTEDBondingCalculator', address)
  return contract
}
