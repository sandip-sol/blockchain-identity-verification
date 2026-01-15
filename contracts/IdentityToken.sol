// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
// import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title IdentityToken
 * @dev Soulbound NFT for KYC/KYB verification
 * Non-transferable tokens representing verified identities
 */
contract IdentityToken is ERC721, AccessControl {
    // using Counters for Counters.Counter;
    
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    // Counters.Counter private _tokenIdCounter;
    
    struct IdentityData {
        bytes32 dataHash;           // Hash of encrypted identity data
        address verifier;           // Address of the verifier
        string verificationType;    // "KYC" or "KYB"
        uint256 verifiedAt;         // Timestamp of verification
        uint256 expiryDate;         // Expiration timestamp
        bool isRevoked;             // Revocation status
    }
    
    // Mapping from token ID to identity data
    mapping(uint256 => IdentityData) public identities;
    
    // Mapping from user address to token ID
    mapping(address => uint256) public userToToken;
    
    // Events
    event IdentityMinted(
        uint256 indexed tokenId,
        address indexed user,
        address indexed verifier,
        string verificationType,
        uint256 expiryDate
    );
    
    event IdentityRevoked(
        uint256 indexed tokenId,
        address indexed user,
        address indexed revokedBy
    );
    
    event IdentityUpdated(
        uint256 indexed tokenId,
        bytes32 newDataHash,
        uint256 newExpiryDate
    );
    
    constructor() ERC721("KYC/KYB Identity Token", "KYCKYB") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VERIFIER_ROLE, msg.sender);
    }
    
    /**
     * @dev Mint new identity token (soulbound)
     * @param user Address of the user being verified
     * @param dataHash Hash of encrypted identity data
     * @param verificationType Type of verification ("KYC" or "KYB")
     * @param expiryDate Expiration timestamp
     */
    function mintIdentityToken(
        address user,
        bytes32 dataHash,
        string memory verificationType,
        uint256 expiryDate
    ) external onlyRole(VERIFIER_ROLE) returns (uint256) {
        require(user != address(0), "Invalid user address");
        require(userToToken[user] == 0, "User already has identity token");
        require(expiryDate > block.timestamp, "Invalid expiry date");
        require(dataHash != bytes32(0), "Invalid data hash");
        
        _tokenIdCounter.increment();
        uint256 tokenId = _tokenIdCounter.current();
        
        _safeMint(user, tokenId);
        
        identities[tokenId] = IdentityData({
            dataHash: dataHash,
            verifier: msg.sender,
            verificationType: verificationType,
            verifiedAt: block.timestamp,
            expiryDate: expiryDate,
            isRevoked: false
        });
        
        userToToken[user] = tokenId;
        
        emit IdentityMinted(tokenId, user, msg.sender, verificationType, expiryDate);
        
        return tokenId;
    }
    
    /**
     * @dev Revoke an identity token
     * @param tokenId ID of the token to revoke
     */
    function revokeToken(uint256 tokenId) external onlyRole(VERIFIER_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        require(!identities[tokenId].isRevoked, "Token already revoked");
        
        identities[tokenId].isRevoked = true;
        address user = ownerOf(tokenId);
        
        emit IdentityRevoked(tokenId, user, msg.sender);
    }
    
    /**
     * @dev Update identity data hash and expiry
     * @param tokenId ID of the token to update
     * @param newDataHash New hash of encrypted identity data
     * @param newExpiryDate New expiration timestamp
     */
    function updateIdentity(
        uint256 tokenId,
        bytes32 newDataHash,
        uint256 newExpiryDate
    ) external onlyRole(VERIFIER_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        require(!identities[tokenId].isRevoked, "Token is revoked");
        require(newExpiryDate > block.timestamp, "Invalid expiry date");
        
        identities[tokenId].dataHash = newDataHash;
        identities[tokenId].expiryDate = newExpiryDate;
        
        emit IdentityUpdated(tokenId, newDataHash, newExpiryDate);
    }
    
    /**
     * @dev Check if user has valid (non-revoked, non-expired) verification
     * @param user Address to check
     */
    function isVerified(address user) external view returns (bool) {
        uint256 tokenId = userToToken[user];
        if (tokenId == 0) return false;
        
        IdentityData memory identity = identities[tokenId];
        return !identity.isRevoked && identity.expiryDate > block.timestamp;
    }
    
    /**
     * @dev Get token metadata
     * @param tokenId ID of the token
     */
    function getTokenMetadata(uint256 tokenId) external view returns (
        bytes32 dataHash,
        address verifier,
        string memory verificationType,
        uint256 verifiedAt,
        uint256 expiryDate,
        bool isRevoked
    ) {
        require(_exists(tokenId), "Token does not exist");
        IdentityData memory identity = identities[tokenId];
        
        return (
            identity.dataHash,
            identity.verifier,
            identity.verificationType,
            identity.verifiedAt,
            identity.expiryDate,
            identity.isRevoked
        );
    }
    
    /**
     * @dev Override transfer functions to make tokens soulbound (non-transferable)
     */
    function _transfer(
        address from,
        address to,
        uint256 tokenId
    ) internal virtual override {
        revert("Soulbound: Transfer not allowed");
    }
    
    /**
     * @dev Override approve to prevent approvals
     */
    function approve(address to, uint256 tokenId) public virtual override {
        revert("Soulbound: Approval not allowed");
    }
    
    /**
     * @dev Override setApprovalForAll to prevent approvals
     */
    function setApprovalForAll(address operator, bool approved) public virtual override {
        revert("Soulbound: Approval not allowed");
    }
    
    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
