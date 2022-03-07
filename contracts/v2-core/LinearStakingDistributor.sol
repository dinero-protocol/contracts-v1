// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

// just like existing staking distributor, but in absolutes
// distributes tokens once every [customisable multiple of epochs]
// hard code adjustment limit of 0.0666% of supply per epoch
// can specify "cutoff block" as well
// this contract will now be vault for the BTRFLY token