// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CounterFactory} from "../../src/beacon/CounterFactory.sol";

contract CounterFactoryScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        CounterFactory factory = new CounterFactory(
            vm.envAddress("COUNTER_BEACON_ADDRESS")
        );

        console.log("Counter factory deployed at:", address(factory));

        vm.stopBroadcast();
    }
}
