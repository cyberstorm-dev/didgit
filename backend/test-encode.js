const { encodeAbiParameters, parseAbiParameters } = require('viem');

// Contribution schema: bytes32 commitHash, string repoName, uint64 timestamp
const commitHash = '0x4cb07e0dcc9652df125705d75bccdf6f85bec6d5000000000000000000000000';
const repoName = 'cyberstorm-dev/didgit';
const timestamp = 1738606323n;

const encoded = encodeAbiParameters(
  parseAbiParameters('bytes32, string, uint64'),
  [commitHash, repoName, timestamp]
);

console.log('Encoded:', encoded);
console.log('Length:', encoded.length);
