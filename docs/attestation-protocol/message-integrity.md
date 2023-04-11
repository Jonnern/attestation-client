# Message integrity checks

While [bit voting](./bit-voting.md) in choose phase ensures agreement on which attestation should be put in the Merkle tree, there is no insurance that all attestation providers will be able to build the same Merkle tree and thus obtain the same Merkle root to vote with. Namely, attestation providers could (usually due to a bug in the code) have issues with consistency of the data obtained from the data source or issues related to calculating the hash of the relevant data, before putting it into the Merkle tree. For that reason, each attestation request contains the **message integrity code**. This is the hash of the attestation response and the string `"Flare"`. Each (non-malicious) requester should already know what the attestation response should be - they are just requesting the Attestation protocol to confirm the data in a decentralized and secure way (by voting of attestation providers). Hence, they provide the message integrity check. Upon making the query to the data source, the attestation provider appends to its own response the string `"Flare"` and calculates the hash. Only if this hash matches the message integrity code provided in the attestation request, the attestation response is considered valid and can be considered for inclusion into the Merkle tree. Bit voting in combination of message integrity codes make the attestation protocol much more robust to attacks that could arise from misbehavior of a subset of attestation providers or bugs in attestation code.

Next: [Merkle tree and Merkle proof](./merkle-tree.md)

[Back to home](../README.md)