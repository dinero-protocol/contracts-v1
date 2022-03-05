#  Smart Contracts That Power the Redacted Cartel Protocol🦋:

Here are the contracts that power REDACTED V1. Our V1 is a friendly fork of OHM, however, it contains a handful of key differences:
- Reserve assets have variable values (that can be set by calling setFloor() within our treasury)
- Bond contracts have been designed to return fees to Olympus
- Different bonding calculators due to our main LP pair being between 2 9dp coins, as opposed to a 9dp/18dp pair

## Tech

Redacted Cartel  uses a number of open source projects to work properly:

- Hardhat - Ethereum development environment.
- Typescript - Strongly Typed JS
- Typechain - TS Types for Solidity Smart Contracts
- Node - JS runtime


And of course Redacted Cartel itself is open source with a public repository on GitHub.

## Installation

Redacted Smart Contracts requires [Node.js](https://nodejs.org/) v10+ to run.

Install the dependencies and devDependencies and start the server.

```sh
cd Redacted-Smart-Contracts
yarn install
```


## Deployed Contracts



| Contract Name | Address |
| ------ | ------ |
| PBTRFLY | 0x57503824e256e878db8136fde66f155c49e362df |
| BTRFLY | 0xc0d4ceb216b3ba9c3701b291766fdcba977cec3a |
| xBTRFLY | 0xCC94Faf235cC5D3Bf4bEd3a30db5984306c86aBC |
| wxBTRFLY | 0x4b16d95ddf1ae4fe8227ed7b7e80cf13275e61c9 |
| Treasury | 0x086C98855dF3C78C6b481b6e1D47BeF42E9aC36B |
|Staking Distributor|0xB2120AE79d838d6703Cf6d2ac5cC68b5DB10683F |
| Staking | 0xBdE4Dfb0dbb0Dd8833eFb6C5BD0Ce048C852C487 |
| Warmup | 0x7521C8c7ba7e1F650c1109c40876C5Dd52f5614c |
| Staking Helper | 0xC0840Ec5527d3e70d66AE6575642916F3Fd18aDf |
| BtrflyOhmBondingCalculator | 0xa77b57445FA262CaE325DeD434Df89302c93f59A |
| LP Bond (OHM / BTRFLY) (retired) | 0x1fDf1233f85A3BAe9594B0558e4EC8Febe8c6720 |
| CVX Bond V1 | 0xe2eF3B60B0B3087cf1d1179D899a7cD7a11a9fCa|
| CVX Bond V2 | 0x3496681EF5e8EBBF01eEEEbAe10084343d65DBEA |
| FXS Bond | 0xfd7bda47cbeeed93c897273585f666f8d1cc8d45 |
| WETH Bond | 0x737119790f6E0F85451Ab200759f8EfA144DCD43 |
| CRV Bond | 0x765c7cfed02f2d9583eac8229930f3650af42c77 |
| ThecosomataETH | 0x68F54c12631a83B5b42F683932f504819F26c4e7 |


## Development
Running All tests
```sh
npx hardhat test
```

Running Specific tests with network
```sh
npx hardhat test ./test/contract --network
```
#### Comiling Contracts 
```sh
npx hardhat compile
```

### Extra Hardhat features 
```shell
npx hardhat accounts
npx hardhat compile
npx hardhat clean
npx hardhat test
npx hardhat node
npx hardhat help
REPORT_GAS=true npx hardhat test
npx hardhat coverage
npx hardhat run scripts/deploy.ts
TS_NODE_FILES=true npx ts-node scripts/deploy.ts
npx eslint '**/*.{js,ts}'
npx eslint '**/*.{js,ts}' --fix
npx prettier '**/*.{json,sol,md}' --check
npx prettier '**/*.{json,sol,md}' --write
npx solhint 'contracts/**/*.sol'
npx solhint 'contracts/**/*.sol' --fix
```
[//]: # 
   [node.js]: <http://nodejs.org>

