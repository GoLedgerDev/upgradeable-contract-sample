// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../../src/uups/Counter.sol";
import {Upgrades} from "@openzeppelin-foundry-upgrades/Upgrades.sol";

contract CounterScript is Script {

    function setUp() public {}

    function run() public {
        vm.startBroadcast();

        //Deploy UUPS Proxy
        address proxy = Upgrades.deployUUPSProxy(
            "Counter.sol",
            abi.encodeCall(Counter.initialize, ())
        );

        console.log("Counter UUPS Proxy deployed at:", proxy);

        vm.stopBroadcast();
    }
}
