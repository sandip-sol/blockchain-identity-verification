// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title DocumentSignatureRegistry
 * @dev Minimal on-chain anchoring for DocuSign-like envelopes.
 * Stores only hashes + signer addresses (no PII).
 */
contract DocumentSignatureRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    struct EnvelopeRecord {
        bytes32 documentHash;
        address[] signers;
        uint256 completedAt;
        string finalCID;
        bool exists;
    }

    mapping(bytes32 => EnvelopeRecord) private _envelopes;

    event EnvelopeCompleted(bytes32 indexed envelopeId, bytes32 documentHash, address[] signers, string finalCID, uint256 completedAt);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    function completeEnvelope(
        bytes32 envelopeId,
        bytes32 documentHash,
        address[] calldata signers,
        string calldata finalCID
    ) external onlyRole(REGISTRAR_ROLE) {
        require(envelopeId != bytes32(0), "Invalid envelopeId");
        require(documentHash != bytes32(0), "Invalid documentHash");
        require(!_envelopes[envelopeId].exists, "Already completed");
        require(signers.length > 0, "No signers");

        EnvelopeRecord storage rec = _envelopes[envelopeId];
        rec.documentHash = documentHash;
        rec.completedAt = block.timestamp;
        rec.finalCID = finalCID;
        rec.exists = true;
        // Copy signers
        for (uint256 i = 0; i < signers.length; i++) {
            rec.signers.push(signers[i]);
        }

        emit EnvelopeCompleted(envelopeId, documentHash, signers, finalCID, block.timestamp);
    }

    function getEnvelope(bytes32 envelopeId)
        external
        view
        returns (bytes32 documentHash, address[] memory signers, uint256 completedAt, string memory finalCID, bool exists)
    {
        EnvelopeRecord storage rec = _envelopes[envelopeId];
        return (rec.documentHash, rec.signers, rec.completedAt, rec.finalCID, rec.exists);
    }
}
