import { BigNumber } from 'ethers'
import { ethers, network } from 'hardhat'

export const impersonateAddressAndReturnSigner = async (address: string) => {
  await network.provider.request({
    method: 'hardhat_impersonateAccount',
    params: [address],
  })
  const signer = await ethers.getSigner('0x364d6D0333432C3Ac016Ca832fb8594A8cE43Ca6')
  return signer
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
