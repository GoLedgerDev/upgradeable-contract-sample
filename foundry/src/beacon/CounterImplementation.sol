// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";

contract CounterImplementation is Initializable, OwnableUpgradeable {
    uint256 public number;
    uint256[50] private _gap;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner) public initializer {
        __Ownable_init(owner);
        number = 0;
    }

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function retrieve() public view returns (uint256) {
        return number;
    }
}
