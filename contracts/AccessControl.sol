// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * @title DataAccessControl
 * @dev Manages consent-based data access using EIP-712 signatures
 * Provides time-limited, granular access control with audit trail
 */
contract DataAccessControl is EIP712 {
    using ECDSA for bytes32;

    struct AccessGrant {
        address requester; // Who is requesting access
        address dataOwner; // Owner of the data
        uint256[] tokenIds; // Token IDs being accessed
        uint256 grantedAt; // Grant timestamp
        uint256 expiresAt; // Expiration timestamp
        bool isRevoked; // Revocation status
        string purpose; // Purpose of access request
    }

    // Mapping from access ID to grant details
    mapping(bytes32 => AccessGrant) public accessGrants;

    // Mapping from data owner to list of access grant IDs
    mapping(address => bytes32[]) public ownerAccessGrants;

    // Mapping from requester to list of access grant IDs
    mapping(address => bytes32[]) public requesterAccessGrants;

    // Nonce for preventing replay attacks
    mapping(address => uint256) public nonces;

    // Events
    event AccessGranted(
        bytes32 indexed accessId,
        address indexed dataOwner,
        address indexed requester,
        uint256[] tokenIds,
        uint256 expiresAt,
        string purpose
    );

    event AccessRevoked(
        bytes32 indexed accessId,
        address indexed dataOwner,
        address indexed requester
    );

    // EIP-712 Type Hash
    bytes32 public constant ACCESS_GRANT_TYPEHASH =
        keccak256(
            "AccessGrant(address requester,uint256[] tokenIds,uint256 expiresAt,string purpose,uint256 nonce)"
        );

    constructor() EIP712("KYC-KYB DataAccessControl", "1") {}

    /**
     * @dev Grant access to data with user signature (EIP-712)
     * @param requester Address requesting access
     * @param tokenIds Array of token IDs to grant access to
     * @param expiresAt Expiration timestamp
     * @param purpose Purpose of the access request
     * @param signature EIP-712 signature from data owner
     */
    function grantAccess(
        address requester,
        uint256[] memory tokenIds,
        uint256 expiresAt,
        string memory purpose,
        bytes memory signature
    ) external returns (bytes32) {
        require(requester != address(0), "Invalid requester address");
        require(tokenIds.length > 0, "No token IDs provided");
        require(expiresAt > block.timestamp, "Invalid expiration time");

        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                ACCESS_GRANT_TYPEHASH,
                requester,
                keccak256(abi.encodePacked(tokenIds)),
                expiresAt,
                keccak256(bytes(purpose)),
                nonces[msg.sender]
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);

        require(signer == msg.sender, "Invalid signature");

        // Increment nonce to prevent replay
        nonces[msg.sender]++;

        // Create unique access ID
        bytes32 accessId = keccak256(
            abi.encodePacked(
                msg.sender,
                requester,
                tokenIds,
                block.timestamp,
                nonces[msg.sender]
            )
        );

        // Store access grant
        accessGrants[accessId] = AccessGrant({
            requester: requester,
            dataOwner: msg.sender,
            tokenIds: tokenIds,
            grantedAt: block.timestamp,
            expiresAt: expiresAt,
            isRevoked: false,
            purpose: purpose
        });

        ownerAccessGrants[msg.sender].push(accessId);
        requesterAccessGrants[requester].push(accessId);

        emit AccessGranted(
            accessId,
            msg.sender,
            requester,
            tokenIds,
            expiresAt,
            purpose
        );

        return accessId;
    }

    /**
     * @dev Revoke previously granted access
     * @param accessId ID of the access grant to revoke
     */
    function revokeAccess(bytes32 accessId) external {
        AccessGrant storage grant = accessGrants[accessId];
        require(grant.dataOwner == msg.sender, "Not authorized");
        require(!grant.isRevoked, "Already revoked");

        grant.isRevoked = true;

        emit AccessRevoked(accessId, msg.sender, grant.requester);
    }

    /**
     * @dev Check if requester currently has valid access to a specific token
     * Capped at MAX_GRANTS_CHECK to prevent DoS with unbounded iteration.
     * For large grant lists, use hasAccessPaginated().
     */
    uint256 public constant MAX_GRANTS_CHECK = 100;

    function hasAccess(
        address requester,
        address dataOwner,
        uint256 tokenId
    ) external view returns (bool) {
        bytes32[] memory grants = ownerAccessGrants[dataOwner];
        uint256 end = grants.length < MAX_GRANTS_CHECK ? grants.length : MAX_GRANTS_CHECK;

        for (uint256 i = 0; i < end; i++) {
            AccessGrant memory grant = accessGrants[grants[i]];

            if (grant.requester != requester) continue;
            if (grant.isRevoked) continue;
            if (grant.expiresAt <= block.timestamp) continue;

            for (uint256 j = 0; j < grant.tokenIds.length; j++) {
                if (grant.tokenIds[j] == tokenId) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @dev Paginated version of hasAccess for data owners with many grants.
     * @param offset Start index in the ownerAccessGrants array
     * @param limit Max number of grants to check
     */
    function hasAccessPaginated(
        address requester,
        address dataOwner,
        uint256 tokenId,
        uint256 offset,
        uint256 limit
    ) external view returns (bool found, uint256 nextOffset) {
        bytes32[] memory grants = ownerAccessGrants[dataOwner];
        if (offset >= grants.length) return (false, grants.length);

        uint256 end = offset + limit;
        if (end > grants.length) end = grants.length;

        for (uint256 i = offset; i < end; i++) {
            AccessGrant memory grant = accessGrants[grants[i]];

            if (grant.requester != requester) continue;
            if (grant.isRevoked) continue;
            if (grant.expiresAt <= block.timestamp) continue;

            for (uint256 j = 0; j < grant.tokenIds.length; j++) {
                if (grant.tokenIds[j] == tokenId) {
                    return (true, i + 1);
                }
            }
        }

        return (false, end);
    }

    /**
     * @dev Get all access grants for a data owner
     * @param dataOwner Address of the data owner
     */
    function getAccessLog(
        address dataOwner
    ) external view returns (bytes32[] memory) {
        return ownerAccessGrants[dataOwner];
    }

    /**
     * @dev Get all access grants requested by an address
     * @param requester Address of the requester
     */
    function getRequesterAccessLog(
        address requester
    ) external view returns (bytes32[] memory) {
        return requesterAccessGrants[requester];
    }

    /**
     * @dev Get details of a specific access grant
     * @param accessId ID of the access grant
     */
    function getAccessGrantDetails(
        bytes32 accessId
    )
        external
        view
        returns (
            address requester,
            address dataOwner,
            uint256[] memory tokenIds,
            uint256 grantedAt,
            uint256 expiresAt,
            bool isRevoked,
            string memory purpose,
            bool isActive
        )
    {
        AccessGrant memory grant = accessGrants[accessId];
        bool active = !grant.isRevoked && grant.expiresAt > block.timestamp;

        return (
            grant.requester,
            grant.dataOwner,
            grant.tokenIds,
            grant.grantedAt,
            grant.expiresAt,
            grant.isRevoked,
            grant.purpose,
            active
        );
    }

    /**
     * @dev Get current nonce for an address (for signing)
     * @param account Address to get nonce for
     */
    function getNonce(address account) external view returns (uint256) {
        return nonces[account];
    }
}
