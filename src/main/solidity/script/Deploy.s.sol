// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "../src/UsernameUniqueResolverV2.sol";

/**
 * @title Deploy
 * @dev Deployment script for UsernameUniqueResolverV2 implementation and optional proxy upgrade
 */
contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Try to get proxy address from environment
        address proxyAddress = vm.envOr("PROXY_ADDRESS", address(0));
        address proxyAdminAddress = vm.envOr("PROXY_ADMIN_ADDRESS", address(0));

        // Get EAS configuration from environment
        address easAddress = vm.envOr("EAS_ADDRESS", address(0x4200000000000000000000000000000000000021)); // Base mainnet default
        bytes32 schemaUid = vm.envOr("EAS_SCHEMA_UID", bytes32(0));
        address verifier = vm.envOr("ATTESTER_ADDRESS", vm.envAddress("VERIFIER_ADDRESS"));
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address owner = vm.envOr("OWNER_ADDRESS", address(0));

        console.log("Deploying UsernameUniqueResolverV2 implementation with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        console.log("EAS Address:", easAddress);
        console.log("Schema UID:", vm.toString(schemaUid));
        console.log("Attester (verifier role):", verifier);
        console.log("Treasury:", treasury);

        vm.startBroadcast(deployerPrivateKey);

        // Deploy new implementation
        UsernameUniqueResolverV2 newImplementation = new UsernameUniqueResolverV2(
            easAddress,
            schemaUid,
            verifier,
            treasury
        );
        console.log("New implementation deployed at:", address(newImplementation));

        if (owner != address(0) && owner != deployer) {
            newImplementation.setOwner(owner);
            console.log("Owner updated to:", owner);
        }

        // If proxy addresses are provided, upgrade the proxy
        if (proxyAddress != address(0) && proxyAdminAddress != address(0)) {
            console.log("Upgrading proxy at:", proxyAddress);
            ProxyAdmin proxyAdmin = ProxyAdmin(proxyAdminAddress);
            proxyAdmin.upgradeAndCall(
                TransparentUpgradeableProxy(payable(proxyAddress)),
                address(newImplementation),
                ""
            );
            console.log("Proxy upgraded successfully");
        }

        vm.stopBroadcast();

        // Verification info
        console.log("\n=== Deployment Summary ===");
        console.log("Implementation: UsernameUniqueResolverV2");
        console.log("Implementation Address:", address(newImplementation));
        if (proxyAddress != address(0)) {
            console.log("Proxy Address:", proxyAddress);
            console.log("ProxyAdmin Address:", proxyAdminAddress);
        }
        console.log("Deployer:", deployer);

        console.log("\n=== Next Steps ===");
        if (proxyAddress == address(0)) {
            console.log("1. Run 'task sol:deploy:proxy' first to deploy the proxy system");
            console.log("2. Set PROXY_ADDRESS and PROXY_ADMIN_ADDRESS env vars");
            console.log("3. Re-run this script to upgrade the proxy");
        } else {
            console.log("1. Proxy upgrade complete - frontend will use same address");
            console.log("2. Test new functionality");
        }
    }
}
