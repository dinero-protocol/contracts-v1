// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity 0.8.0;

// just like existing staking distributor, but in absolutes
// hard code adjustment limit of 0.5% of supply per epoch
// can specify "cutoff block" as well