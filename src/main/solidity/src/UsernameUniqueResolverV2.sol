// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * UsernameUniqueResolver V2
 * - 3 roles: owner, verifier, treasury
 * - Gist verification via verifier signature
 * - Registration fees
 */

library StringsLower {
  function toLower(string memory s) internal pure returns (string memory) {
    bytes memory b = bytes(s);
    for (uint256 i = 0; i < b.length; i++) {
      bytes1 c = b[i];
      if (c >= 0x41 && c <= 0x5A) {
        b[i] = bytes1(uint8(c) + 32);
      }
    }
    return string(b);
  }
}

contract UsernameUniqueResolverV2 {
  using StringsLower for string;

  // Errors
  error IDENTITY_TAKEN(string domain, string username, address currentOwner);
  error IDENTITY_NOT_FOUND(string domain, string username);
  error NOT_OWNER();
  error NOT_AUTHORIZED();
  error INVALID_VERIFIER_SIGNATURE();
  error SIGNATURE_EXPIRED();
  error INSUFFICIENT_FEE();
  error INVALID_DOMAIN(string domain);
  error INVALID_USERNAME(string username);

  // Events
  event IdentityBound(string indexed domain, string indexed usernameLower, address indexed owner, bytes32 attestationUid);
  event IdentityUnbound(string indexed domain, string indexed usernameLower, address indexed owner, bytes32 attestationUid);
  event RepoPatternSet(string indexed domain, string indexed usernameLower, string namespace, string name, bool enabled);
  event RoleUpdated(string role, address indexed oldAddress, address indexed newAddress);
  event FeeUpdated(uint256 oldFee, uint256 newFee);

  // Roles
  address public owner;
  address public verifier;
  address public treasury;

  // Config
  uint256 public registrationFee;

  // EAS context
  address public immutable eas;
  bytes32 public immutable schemaUid;

  // Repository pattern
  struct RepositoryPattern {
    string namespace;
    string name;
    bool enabled;
  }

  // Storage
  mapping(bytes32 => address) public ownerOf;
  mapping(bytes32 => bytes32) public attestationOf;
  mapping(bytes32 => mapping(bytes32 => bool)) private repoPatterns;
  mapping(bytes32 => RepositoryPattern[]) private repoPatternList;

  constructor(address _eas, bytes32 _schemaUid, address _verifier, address _treasury) {
    eas = _eas;
    schemaUid = _schemaUid;
    owner = msg.sender;
    verifier = _verifier;
    treasury = _treasury;
    registrationFee = 0; // Start with 0, can increase later
  }

  modifier onlyOwner() {
    if (msg.sender != owner) revert NOT_AUTHORIZED();
    _;
  }

  // Role management
  function setOwner(address _owner) external onlyOwner {
    emit RoleUpdated("owner", owner, _owner);
    owner = _owner;
  }

  function setVerifier(address _verifier) external onlyOwner {
    emit RoleUpdated("verifier", verifier, _verifier);
    verifier = _verifier;
  }

  function setTreasury(address _treasury) external onlyOwner {
    emit RoleUpdated("treasury", treasury, _treasury);
    treasury = _treasury;
  }

  function setRegistrationFee(uint256 _fee) external onlyOwner {
    emit FeeUpdated(registrationFee, _fee);
    registrationFee = _fee;
  }

  // Key computation
  function _identityKey(string memory domain, string memory username) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(domain.toLower(), ":", username.toLower()));
  }

  function _patternKey(string memory namespace, string memory name) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(namespace, "/", name));
  }

  // Validation
  function _validateDomain(string memory domain) internal pure {
    bytes memory domainBytes = bytes(domain);
    if (domainBytes.length == 0 || domainBytes.length > 100) {
      revert INVALID_DOMAIN(domain);
    }
  }

  function _validateUsername(string memory username) internal pure {
    bytes memory usernameBytes = bytes(username);
    if (usernameBytes.length == 0 || usernameBytes.length > 39) {
      revert INVALID_USERNAME(username);
    }
  }

  /**
   * Bind identity with verifier approval
   * @param attestationUid EAS attestation UID
   * @param recipient Wallet address to bind
   * @param domain Platform domain (e.g., "github.com")
   * @param username Platform username
   * @param gistUrl URL to proof gist
   * @param expiry Signature expiry timestamp
   * @param verifierSig Verifier's signature of approval
   */
  function bindIdentityWithApproval(
    bytes32 attestationUid,
    address recipient,
    string calldata domain,
    string calldata username,
    string calldata gistUrl,
    uint256 expiry,
    bytes calldata verifierSig
  ) external payable {
    _validateDomain(domain);
    _validateUsername(username);

    // Check fee
    if (msg.value < registrationFee) revert INSUFFICIENT_FEE();

    // Check expiry
    if (block.timestamp > expiry) revert SIGNATURE_EXPIRED();

    // Verify verifier signature
    bytes32 messageHash = keccak256(abi.encodePacked(
      "\x19Ethereum Signed Message:\n32",
      keccak256(abi.encode(domain, username, recipient, gistUrl, expiry))
    ));
    
    address recovered = _recoverSigner(messageHash, verifierSig);
    if (recovered != verifier) revert INVALID_VERIFIER_SIGNATURE();

    // Check identity not taken
    bytes32 identityKey = _identityKey(domain, username);
    address current = ownerOf[identityKey];
    if (current != address(0) && current != recipient) {
      revert IDENTITY_TAKEN(domain, username, current);
    }

    // Bind identity
    ownerOf[identityKey] = recipient;
    attestationOf[identityKey] = attestationUid;

    // Set default */* pattern
    bytes32 wildcardPatternKey = _patternKey("*", "*");
    repoPatterns[identityKey][wildcardPatternKey] = true;
    repoPatternList[identityKey].push(RepositoryPattern({
      namespace: "*",
      name: "*",
      enabled: true
    }));

    // Transfer fee to treasury
    if (msg.value > 0 && treasury != address(0)) {
      payable(treasury).transfer(msg.value);
    }

    emit IdentityBound(domain, username.toLower(), recipient, attestationUid);
    emit RepoPatternSet(domain, username.toLower(), "*", "*", true);
  }

  // Legacy bindIdentity for backwards compat (no verifier check, only for testing)
  function bindIdentity(
    bytes32 attestationUid,
    address recipient,
    string calldata domain,
    string calldata username
  ) external {
    _validateDomain(domain);
    _validateUsername(username);

    bytes32 identityKey = _identityKey(domain, username);
    address current = ownerOf[identityKey];
    if (current != address(0) && current != recipient) {
      revert IDENTITY_TAKEN(domain, username, current);
    }
    
    ownerOf[identityKey] = recipient;
    attestationOf[identityKey] = attestationUid;

    bytes32 wildcardPatternKey = _patternKey("*", "*");
    repoPatterns[identityKey][wildcardPatternKey] = true;
    repoPatternList[identityKey].push(RepositoryPattern({
      namespace: "*",
      name: "*",
      enabled: true
    }));

    emit IdentityBound(domain, username.toLower(), recipient, attestationUid);
    emit RepoPatternSet(domain, username.toLower(), "*", "*", true);
  }

  function unbindIdentity(
    bytes32 attestationUid,
    address recipient,
    string calldata domain,
    string calldata username
  ) external {
    bytes32 identityKey = _identityKey(domain, username);
    if (ownerOf[identityKey] == recipient) {
      delete ownerOf[identityKey];
      delete attestationOf[identityKey];
      delete repoPatternList[identityKey];
      emit IdentityUnbound(domain, username.toLower(), recipient, attestationUid);
    }
  }

  function setRepositoryPattern(
    string calldata domain,
    string calldata identifier,
    string calldata namespace,
    string calldata name,
    bool enabled
  ) external {
    bytes32 identityKey = _identityKey(domain, identifier);
    if (ownerOf[identityKey] != msg.sender) revert NOT_OWNER();

    bytes32 patternKey = _patternKey(namespace, name);
    repoPatterns[identityKey][patternKey] = enabled;

    RepositoryPattern[] storage patterns = repoPatternList[identityKey];
    bool found = false;
    for (uint256 i = 0; i < patterns.length; i++) {
      if (keccak256(bytes(patterns[i].namespace)) == keccak256(bytes(namespace)) &&
          keccak256(bytes(patterns[i].name)) == keccak256(bytes(name))) {
        patterns[i].enabled = enabled;
        found = true;
        break;
      }
    }
    if (!found && enabled) {
      patterns.push(RepositoryPattern({ namespace: namespace, name: name, enabled: enabled }));
    }

    emit RepoPatternSet(domain, identifier.toLower(), namespace, name, enabled);
  }

  function isRepositoryEnabled(
    string calldata,
    string calldata domain,
    string calldata identifier,
    string calldata namespace,
    string calldata name
  ) external view returns (bool) {
    bytes32 identityKey = _identityKey(domain, identifier);
    if (ownerOf[identityKey] == address(0)) return false;

    bytes32 patternKey = _patternKey(namespace, name);
    if (repoPatterns[identityKey][patternKey]) return true;

    RepositoryPattern[] storage patterns = repoPatternList[identityKey];
    for (uint256 i = 0; i < patterns.length; i++) {
      if (!patterns[i].enabled) continue;
      bool namespaceMatch = keccak256(bytes(patterns[i].namespace)) == keccak256(bytes("*")) ||
                           keccak256(bytes(patterns[i].namespace)) == keccak256(bytes(namespace));
      bool nameMatch = keccak256(bytes(patterns[i].name)) == keccak256(bytes("*")) ||
                      keccak256(bytes(patterns[i].name)) == keccak256(bytes(name));
      if (namespaceMatch && nameMatch) return true;
    }
    return false;
  }

  function identityExists(string calldata domain, string calldata identifier) external view returns (bool) {
    return ownerOf[_identityKey(domain, identifier)] != address(0);
  }

  function getIdentityOwner(string calldata domain, string calldata identifier) external view returns (address) {
    return ownerOf[_identityKey(domain, identifier)];
  }

  // ECDSA recovery
  function _recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address) {
    require(signature.length == 65, "Invalid signature length");
    bytes32 r;
    bytes32 s;
    uint8 v;
    assembly {
      r := mload(add(signature, 32))
      s := mload(add(signature, 64))
      v := byte(0, mload(add(signature, 96)))
    }
    if (v < 27) v += 27;
    return ecrecover(messageHash, v, r, s);
  }
}
