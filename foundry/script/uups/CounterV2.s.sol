// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Upgrades} from "@openzeppelin-foundry-upgrades/Upgrades.sol";

contract CounterV2Script is Script {
    function run() public {
        vm.startBroadcast();

        Upgrades.upgradeProxy(
            vm.envAddress("PROXY_ADDRESS"),
            "CounterV2.sol",
            ""
        );

        console.log("Counter upgraded to V2");

        vm.stopBroadcast();
    }
}
