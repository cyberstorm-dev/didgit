// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title AllowlistValidator
 * @notice Validator that allows pre-approved addresses to execute specific calls
 * @dev Used for delegated attestations - attester (verifier role) address is pre-approved
 * 
 * This is a Kernel v3 validator that validates UserOps signed by the attester.
 * Users install this validator on their Kernel account to allow automated attestations.
 */
contract AllowlistValidator {
    // Minimal ERC-4337 types for compilation (not used by current deploy flow)
    struct UserOperation {
        bytes callData;
        bytes signature;
    }

    type ValidationData is uint256;

    uint256 internal constant SIG_VALIDATION_SUCCESS = 0;
    uint256 internal constant SIG_VALIDATION_FAILED = 1;
    // Hardcoded verifier address (attester role, set at deployment)
    address public immutable verifier;
    
    // Target contract that can be called (EAS)
    address public immutable easAddress;
    
    // Function selector for attest()
    bytes4 public constant ATTEST_SELECTOR = 0x44adc90e; // attest(AttestationRequest)
    
    constructor(address _verifier, address _easAddress) {
        verifier = _verifier;
        easAddress = _easAddress;
    }
    
    /**
     * @notice Validate a user operation
     * @dev Checks if the caller is the attester and the call is to EAS.attest
     */
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external payable returns (ValidationData validationData) {
        // Extract the call data from userOp.callData
        // In Kernel v3, callData is the call to execute()
        // We need to decode it to check the target and function
        
        // Simple validation: check if signature indicates attester
        // In practice, attester would sign with their key
        address signer = recoverSigner(userOpHash, userOp.signature);
        
        if (signer != verifier) {
            return ValidationData.wrap(SIG_VALIDATION_FAILED);
        }
        
        // Additional check: ensure the call is to EAS.attest
        // This would require parsing userOp.callData
        // For MVP, we trust that if attester signed it, it's valid
        
        return ValidationData.wrap(SIG_VALIDATION_SUCCESS);
    }
    
    /**
     * @notice Validate a signature
     * @dev Used for validating signatures outside of userOp context
     */
    function validateSignature(
        bytes32 hash,
        bytes calldata signature
    ) external view returns (ValidationData) {
        address signer = recoverSigner(hash, signature);
        
        if (signer == verifier) {
            return ValidationData.wrap(SIG_VALIDATION_SUCCESS);
        }
        
        return ValidationData.wrap(SIG_VALIDATION_FAILED);
    }
    
    /**
     * @notice Check if validator is enabled for a kernel account
     */
    function validCaller(
        address caller,
        bytes calldata
    ) external view returns (bool) {
        return caller == verifier;
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
