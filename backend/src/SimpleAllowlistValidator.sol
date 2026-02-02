// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title SimpleAllowlistValidator
 * @notice Minimal validator for Kernel v3 that allows pre-approved addresses
 * @dev This is a simplified implementation for didgit delegated attestations
 */
contract SimpleAllowlistValidator {
    address public immutable verifier;
    address public immutable easAddress;
    
    constructor(address _verifier, address _easAddress) {
        verifier = _verifier;
        easAddress = _easAddress;
    }
    
    /**
     * @notice Check if an address is allowed to execute operations
     * @param caller The address attempting to execute
     * @return true if caller is the verifier
     */
    function isValidCaller(address caller) external view returns (bool) {
        return caller == verifier;
    }
    
    /**
     * @notice Validate a signature
     * @param hash The hash that was signed
     * @param signature The signature to validate
     * @return 0 if valid (SIG_VALIDATION_SUCCESS), 1 otherwise
     */
    function validateSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (uint256) {
        address signer = recoverSigner(hash, signature);
        return signer == verifier ? 0 : 1;
    }
    
    /**
     * @notice Recover signer from hash and signature
     */
    function recoverSigner(
        bytes32 hash,
        bytes memory signature
    ) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");
        
        bytes32 r;
        bytes32 s;
        uint8 v;
        
        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }
        
        if (v < 27) {
            v += 27;
        }
        
        require(v == 27 || v == 28, "Invalid signature v value");
        
        return ecrecover(hash, v, r, s);
    }
}
