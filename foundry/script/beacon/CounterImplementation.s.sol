// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CounterImplementation} from "../../src/beacon/CounterImplementation.sol";

contract CounterImplementationScript is Script {

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        CounterImplementation counter = new CounterImplementation();

        console.log("Counter implementation deployed at:", address(counter));

        vm.stopBroadcast();
    }
}
