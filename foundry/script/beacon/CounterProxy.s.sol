// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CounterFactory} from "../../src/beacon/CounterFactory.sol";

contract CounterProxyScript is Script {
    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        CounterFactory factory = CounterFactory(
            vm.envAddress("COUNTER_FACTORY_ADDRESS")
        );

        address proxy1 = factory.createCounter();
        console.log("Counter proxy 1 deployed at:", proxy1);

        address proxy2 = factory.createCounter();
        console.log("Counter proxy 2 deployed at:", proxy2);

        vm.stopBroadcast();
    }
}
