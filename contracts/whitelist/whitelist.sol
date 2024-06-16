// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Whitelist is Ownable {
    mapping(address => bool) private whitelistedAddresses;

    event Whitelisted(address indexed user, bool isWhitelisted);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setWhitelisted(address _user, bool _isWhitelisted) external onlyOwner {
        whitelistedAddresses[_user] = _isWhitelisted;
        emit Whitelisted(_user, _isWhitelisted);
    }

    function isWhitelisted(address _user) external view returns (bool) {
        return whitelistedAddresses[_user];
    }
}
