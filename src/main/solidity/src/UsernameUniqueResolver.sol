// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * UsernameUniqueResolver
 * - EAS SchemaResolver for GitHub username binding schema with repository pattern tracking
 * - Enforces global uniqueness of lowercase(domain + username) combinations
 * - Tracks repository patterns for each username to enable selective attestation indexing
 * - Supports wildcard patterns (*, namespace/*, */name, namespace/name)
 */
interface IEASLikeMinimal {
  // Placeholder – not used directly in this skeleton.
}

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

contract UsernameUniqueResolver {
  using StringsLower for string;

  error IDENTITY_TAKEN(string domain, string username, address currentOwner);
  error IDENTITY_NOT_FOUND(string domain, string username);
  error NOT_OWNER();
  error INVALID_DOMAIN(string domain);
  error INVALID_USERNAME(string username);

  event IdentityBound(string indexed domain, string indexed usernameLower, address indexed owner, bytes32 attestationUid);
  event IdentityUnbound(string indexed domain, string indexed usernameLower, address indexed owner, bytes32 attestationUid);
  event RepoPatternSet(string indexed domain, string indexed usernameLower, string namespace, string name, bool enabled);

  // Repository pattern structure for enumeration
  struct RepositoryPattern {
    string namespace;
    string name;
    bool enabled;
  }

  // Identity struct for convenience lookups
  struct Identity {
    string domain;
    string identifier;
    uint256 patternCount;
  }

  // EAS + Schema context (for reference/config)
  address public immutable eas;
  bytes32 public immutable schemaUid;

  // keccak256(domain + usernameLower) => owner
  mapping(bytes32 => address) public ownerOf;

  // keccak256(domain + usernameLower) => attestationUid
  mapping(bytes32 => bytes32) public attestationOf;

  // keccak256(domain + usernameLower) => keccak256(namespace '/' name) => enabled
  mapping(bytes32 => mapping(bytes32 => bool)) private repoPatterns;

  // keccak256(domain + usernameLower) => RepositoryPattern[]
  mapping(bytes32 => RepositoryPattern[]) private repoPatternList;

  constructor(address _eas, bytes32 _schemaUid) {
    eas = _eas;
    schemaUid = _schemaUid;
  }

  // Computes the key used to index repository patterns
  function _patternKey(string memory namespace, string memory name) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(namespace, "/", name));
  }

  // Computes the identity key for domain + username
  function _identityKey(string memory domain, string memory username) internal pure returns (bytes32) {
    return keccak256(abi.encodePacked(domain.toLower(), ":", username.toLower()));
  }

  // Validate domain format (basic validation)
  function _validateDomain(string memory domain) internal pure {
    bytes memory domainBytes = bytes(domain);
    if (domainBytes.length == 0 || domainBytes.length > 100) {
      revert INVALID_DOMAIN(domain);
    }
  }

  // Validate username format
  function _validateUsername(string memory username) internal pure {
    bytes memory usernameBytes = bytes(username);
    if (usernameBytes.length == 0 || usernameBytes.length > 39) {
      revert INVALID_USERNAME(username);
    }
  }

  // Called by EAS resolver hook on successful attestation (wire this from onAttest)
  function bindIdentity(bytes32 attestationUid, address recipient, string calldata domain, string calldata username) external {
    // If integrating with EAS, guard this with onlyEAS modifier. For now, open to allow testing.
    _validateDomain(domain);
    _validateUsername(username);

    bytes32 identityKey = _identityKey(domain, username);
    address current = ownerOf[identityKey];
    if (current != address(0) && current != recipient) {
      revert IDENTITY_TAKEN(domain, username, current);
    }
    ownerOf[identityKey] = recipient;
    attestationOf[identityKey] = attestationUid;

    // Automatically set default */* pattern for new identities
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

  // Called by EAS resolver hook on revoke (wire this from onRevoke)
  function unbindIdentity(bytes32 attestationUid, address recipient, string calldata domain, string calldata username) external {
    bytes32 identityKey = _identityKey(domain, username);
    if (ownerOf[identityKey] == recipient) {
      delete ownerOf[identityKey];
      delete attestationOf[identityKey];
      // Clear repository patterns
      delete repoPatternList[identityKey];
      emit IdentityUnbound(domain, username.toLower(), recipient, attestationUid);
    }
  }

  // Manage repository patterns for indexing. Only current owner of the identity may mutate.
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

    // Update the pattern mapping
    repoPatterns[identityKey][patternKey] = enabled;

    // Update the pattern list for enumeration
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
      patterns.push(RepositoryPattern({
        namespace: namespace,
        name: name,
        enabled: enabled
      }));
    }

    emit RepoPatternSet(domain, identifier.toLower(), namespace, name, enabled);
  }

  function isRepositoryEnabled(
    string calldata owner,
    string calldata domain,
    string calldata identifier,
    string calldata namespace,
    string calldata name
  ) external view returns (bool) {
    bytes32 identityKey = _identityKey(domain, identifier);
    if (ownerOf[identityKey] == address(0)) return false;

    bytes32 patternKey = _patternKey(namespace, name);

    // Check exact match first
    if (repoPatterns[identityKey][patternKey]) {
      return true;
    }

    // Check wildcard patterns
    RepositoryPattern[] storage patterns = repoPatternList[identityKey];
    for (uint256 i = 0; i < patterns.length; i++) {
      if (!patterns[i].enabled) continue;

      bool namespaceMatch = keccak256(bytes(patterns[i].namespace)) == keccak256(bytes("*")) ||
                           keccak256(bytes(patterns[i].namespace)) == keccak256(bytes(namespace));
      bool nameMatch = keccak256(bytes(patterns[i].name)) == keccak256(bytes("*")) ||
                      keccak256(bytes(patterns[i].name)) == keccak256(bytes(name));

      if (namespaceMatch && nameMatch) {
        return true;
      }
    }

    return false;
  }

  // Get all repository patterns for an identity (only callable by owner)
  function getRepositoryPatterns(
    string calldata domain,
    string calldata identifier
  ) external view returns (RepositoryPattern[] memory patterns) {
    bytes32 identityKey = _identityKey(domain, identifier);
    if (ownerOf[identityKey] != msg.sender) revert NOT_OWNER();
    return repoPatternList[identityKey];
  }

  // Check if an identity exists
  function identityExists(
    string calldata domain,
    string calldata identifier
  ) external view returns (bool exists) {
    bytes32 identityKey = _identityKey(domain, identifier);
    return ownerOf[identityKey] != address(0);
  }

  // Get the owner of an identity
  function getIdentityOwner(
    string calldata domain,
    string calldata identifier
  ) external view returns (address owner) {
    bytes32 identityKey = _identityKey(domain, identifier);
    return ownerOf[identityKey];
  }

  // Convenience function to get all identities for current user
  function getMyIdentities() external view returns (Identity[] memory) {
    // This would require tracking all identities per user
    // For now, return empty array - can be implemented if needed
    return new Identity[](0);
  }
}

