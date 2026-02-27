// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.19;

import {Initializable} from "@openzeppelin-contracts-upgradeable/contracts/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin-contracts-upgradeable/contracts/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin-contracts-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";

contract Counter is Initializable, OwnableUpgradeable, UUPSUpgradeable {
    uint256 public number;

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        number = 0;
    }

    function setNumber(uint256 newNumber) public {
        number = newNumber;
    }

    function retrieve() public view returns (uint256) {
        return number;
    }

    function _authorizeUpgrade(
        address newImplementation
    ) internal override onlyOwner {}
}
