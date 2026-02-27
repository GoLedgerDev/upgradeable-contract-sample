// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Counter} from "./Counter.sol";

/// @custom:oz-upgrades-from Counter
contract CounterV2 is Counter {

    function increment() public {
        number += 1;
    }

}
