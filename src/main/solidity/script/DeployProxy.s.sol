// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import "@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol";
import "@openzeppelin/contracts/proxy/transparent/ProxyAdmin.sol";
import "../src/UsernameUniqueResolverV2.sol";

/**
 * @title DeployProxy
 * @dev Deployment script for upgradeable proxy system with UsernameUniqueResolverV2
 */
contract DeployProxy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        // Get EAS configuration from environment
        address easAddress = vm.envOr("EAS_ADDRESS", address(0x4200000000000000000000000000000000000021)); // Base mainnet default
        bytes32 schemaUid = vm.envOr("EAS_SCHEMA_UID", bytes32(0));
        address verifier = vm.envOr("ATTESTER_ADDRESS", address(0));
        if (verifier == address(0)) {
            verifier = vm.envAddress("VERIFIER_ADDRESS");
        }
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address owner = vm.envOr("OWNER_ADDRESS", address(0));

        console.log("Deploying proxy system with deployer:", deployer);
        console.log("Deployer balance:", deployer.balance);
        console.log("EAS Address:", easAddress);
        console.log("Schema UID:", vm.toString(schemaUid));
        console.log("Attester (verifier role):", verifier);
        console.log("Treasury:", treasury);
        if (owner != address(0)) {
            console.log("Owner:", owner);
        }

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy implementation contract
        UsernameUniqueResolverV2 implementation = new UsernameUniqueResolverV2(
            easAddress,
            schemaUid,
            verifier,
            treasury
        );
        console.log("Implementation deployed at:", address(implementation));

        // 2. Deploy ProxyAdmin (manages upgrades)
        ProxyAdmin proxyAdmin = new ProxyAdmin(deployer);
        console.log("ProxyAdmin deployed at:", address(proxyAdmin));
        if (owner != address(0) && owner != deployer) {
            proxyAdmin.transferOwnership(owner);
            console.log("ProxyAdmin owner transferred to:", owner);
        }

        // 3. Initialize proxy storage
        address initOwner = owner == address(0) ? deployer : owner;
        bytes memory initData = abi.encodeCall(
            UsernameUniqueResolverV2.initialize,
            (initOwner, verifier, treasury)
        );

        // 4. Deploy TransparentUpgradeableProxy
        TransparentUpgradeableProxy proxy = new TransparentUpgradeableProxy(
            address(implementation),
            address(proxyAdmin),
            initData
        );
        console.log("Proxy deployed at:", address(proxy));

        vm.stopBroadcast();

        // Verification info
        console.log("\n=== Deployment Summary ===");
        console.log("Implementation: UsernameUniqueResolverV2");
        console.log("Implementation Address:", address(implementation));
        console.log("ProxyAdmin Address:", address(proxyAdmin));
        console.log("Proxy Address:", address(proxy));
        console.log("Deployer:", deployer);

        console.log("\n=== Environment Variables ===");
        console.log("Add to your .env file:");
        console.log("VITE_RESOLVER_ADDRESS=", address(proxy));

        console.log("\n=== Next Steps ===");
        console.log("1. Add VITE_RESOLVER_ADDRESS to your .env file");
        console.log("2. Update frontend to use the proxy address");
        console.log("3. Test contract functionality through proxy");
        console.log("4. Future upgrades: deploy new implementation and call upgradeAndCall on ProxyAdmin");
    }
}
