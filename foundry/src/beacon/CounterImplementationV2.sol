// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {CounterImplementation} from "./CounterImplementation.sol";

/// @custom:oz-upgrades-from CounterImplementation
contract CounterImplementationV2 is CounterImplementation {

    function increment() public {
        number += 1;
    }

}
