// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Script, console} from "forge-std/Script.sol";
import {Counter} from "../../src/uups/Counter.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract CounterScript is Script {
    function run() public {
        vm.startBroadcast();

        Counter implementation = new Counter();
        bytes memory initData = abi.encodeCall(Counter.initialize, ());
        ERC1967Proxy proxy = new ERC1967Proxy(address(implementation), initData);

        console.log("Implementation:", address(implementation));
        console.log("Proxy:", address(proxy));
        console.log("Initial number:", Counter(address(proxy)).retrieve());

        vm.stopBroadcast();
    }
}