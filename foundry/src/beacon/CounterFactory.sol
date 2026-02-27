// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {CounterImplementation} from "./CounterImplementation.sol";

contract CounterFactory {
    address public immutable BEACON;

    event CounterCreated(address proxy, address owner);

    constructor(address _beacon) {
        BEACON = _beacon;
    }

    function createCounter() external returns (address) {
        BeaconProxy proxy = new BeaconProxy(
            BEACON,
            abi.encodeCall(CounterImplementation.initialize, (msg.sender))
        );

        emit CounterCreated(address(proxy), msg.sender);
        return address(proxy);
    }
}