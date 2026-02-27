// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {UpgradeableBeacon} from "@openzeppelin/contracts/proxy/beacon/UpgradeableBeacon.sol";

contract CounterBeacon is UpgradeableBeacon {
    constructor(address implementation) UpgradeableBeacon(implementation, msg.sender) {}
}