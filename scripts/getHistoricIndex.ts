import { ethers } from "hardhat";

async function main() {

    const OLDWXBTRFLY = "0x186e55c0bebd2f69348d94c4a27556d93c5bd36c"

    const oldWxbtrfly = await ethers.getContractAt("wxBTRFLY",OLDWXBTRFLY)

    console.log(await oldWxbtrfly.realIndex())

}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });  