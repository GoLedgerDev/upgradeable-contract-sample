// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Test} from "forge-std/Test.sol";
import {CounterV2} from "../src/uups/CounterV2.sol";

contract CounterTest is Test {
    CounterV2 public counter;

    function setUp() public {
        counter = new CounterV2();
    }

    function test_Increment() public {
        counter.increment();
        assertEq(counter.number(), 1);
    }
}
