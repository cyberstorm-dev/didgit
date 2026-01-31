// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {Resolver} from "../src/Resolver.sol";

contract ResolverTest is Test {
    Resolver resolver;

    function setUp() public {
        // Base Sepolia EAS (example) and schema UID placeholder
        address eas = address(0x4200000000000000000000000000000000000021);
        bytes32 schemaUid = 0x7e4a502d6e04b8ff7a80ac8b852c8b53199fe297ddf092a63fffb2a5a062b1b7;
        resolver = new Resolver(eas, schemaUid);
    }

    function testInit() public {
        assertEq(resolver.eas(), address(0x4200000000000000000000000000000000000021));
    }
}

