// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title AttestationRelay
 * @notice Allows authorized verifier to sign attestation requests off-chain
 * @dev Users submit verifier-signed attestations, paying gas themselves
 */
contract AttestationRelay {
    address public immutable verifier;
    address public immutable eas;
    
    // EIP-712 domain
    bytes32 public immutable DOMAIN_SEPARATOR;
    bytes32 public constant ATTESTATION_TYPEHASH = keccak256(
        "Attestation(bytes32 schema,address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 nonce,uint256 deadline)"
    );
    
    mapping(address => uint256) public nonces;
    
    event AttestationRelayed(
        address indexed submitter,
        address indexed recipient,
        bytes32 indexed attestationUid
    );
    
    error InvalidSignature();
    error DeadlineExpired();
    error AttestationFailed();
    
    constructor(address _verifier, address _eas) {
        verifier = _verifier;
        eas = _eas;
        
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("AttestationRelay"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }
    
    struct AttestationRequest {
        bytes32 schema;
        address recipient;
        uint64 expirationTime;
        bool revocable;
        bytes32 refUID;
        bytes data;
        uint256 nonce;
        uint256 deadline;
    }
    
    /**
     * @notice Submit a verifier-signed attestation
     * @param request The attestation request
     * @param signature The verifier's signature (65 bytes)
     */
    function relayAttestation(
        AttestationRequest calldata request,
        bytes calldata signature
    ) external returns (bytes32) {
        // Check deadline
        if (block.timestamp > request.deadline) revert DeadlineExpired();
        
        // Verify nonce
        if (request.nonce != nonces[request.recipient]) revert InvalidSignature();
        nonces[request.recipient]++;
        
        // Verify signature
        bytes32 digest = keccak256(
            abi.encodePacked(
                "\x19\x01",
                DOMAIN_SEPARATOR,
                keccak256(
                    abi.encode(
                        ATTESTATION_TYPEHASH,
                        request.schema,
                        request.recipient,
                        request.expirationTime,
                        request.revocable,
                        request.refUID,
                        keccak256(request.data),
                        request.nonce,
                        request.deadline
                    )
                )
            )
        );
        
        address signer = recoverSigner(digest, signature);
        if (signer != verifier) revert InvalidSignature();
        
        // Call EAS to create attestation
        (bool success, bytes memory result) = eas.call(
            abi.encodeWithSignature(
                "attest((bytes32,(address,uint64,bool,bytes32,bytes,uint256)))",
                request.schema,
                request.recipient,
                request.expirationTime,
                request.revocable,
                request.refUID,
                request.data,
                uint256(0) // value
            )
        );
        
        if (!success) revert AttestationFailed();
        
        bytes32 attestationUid = abi.decode(result, (bytes32));
        
        emit AttestationRelayed(msg.sender, request.recipient, attestationUid);
        
        return attestationUid;
    }
    
    function recoverSigner(bytes32 digest, bytes memory signature) internal pure returns (address) {
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
        
        return ecrecover(digest, v, r, s);
    }
}
