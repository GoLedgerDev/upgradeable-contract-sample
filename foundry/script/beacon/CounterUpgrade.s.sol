// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CounterBeacon} from "../../src/beacon/CounterBeacon.sol";
import {CounterImplementationV2} from "../../src/beacon/CounterImplementationV2.sol";

contract CounterUpgradeScript is Script {

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        CounterImplementationV2 newImplementation = new CounterImplementationV2();

        CounterBeacon beacon = CounterBeacon(vm.envAddress("COUNTER_BEACON_ADDRESS"));
        beacon.upgradeTo(address(newImplementation));       
        
        console.log("Counter beacon upgraded to new implementation at:", address(newImplementation));

        vm.stopBroadcast();
    }
}
