// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {CounterBeacon} from "../../src/beacon/CounterBeacon.sol";

contract CounterBeaconScript is Script {

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        CounterBeacon beacon = new CounterBeacon(vm.envAddress("IMPLEMENTATION_ADDRESS"));

        console.log("Counter beacon deployed at:", address(beacon));

        vm.stopBroadcast();
    }
}
