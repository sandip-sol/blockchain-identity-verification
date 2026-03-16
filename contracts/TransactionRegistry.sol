// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title TransactionRegistry
 * @dev Registry for tokenized transaction proofs using ERC-1155
 * Enables selective transaction disclosure and verification
 */
contract TransactionRegistry is ERC1155, AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    // Simple tokenId counter (replaces Counters.sol). Start at 1 so 0 means "not set".
    uint256 private _nextTokenId = 1;

    struct TransactionData {
        bytes32 txHash; // Hash of transaction data
        string txType; // Type: "invoice", "payment", "transfer", etc.
        bytes32 metadata; // Additional hashed metadata
        address registeredBy; // User who registered the transaction
        uint256 timestamp; // Registration timestamp
        bool isValid; // Validity status
    }

    // Mapping from token ID to transaction data
    mapping(uint256 => TransactionData) public transactions;

    // Mapping from transaction hash to token ID (for lookup). 0 means "not registered".
    mapping(bytes32 => uint256) public txHashToToken;

    // Mapping from user to their transaction token IDs
    mapping(address => uint256[]) public userTransactions;

    // Events
    event TransactionRegistered(
        uint256 indexed tokenId,
        address indexed registeredBy,
        bytes32 indexed txHash,
        string txType,
        uint256 timestamp
    );

    event TransactionBatchRegistered(
        uint256[] tokenIds,
        address indexed registeredBy,
        uint256 count
    );

    event TransactionInvalidated(
        uint256 indexed tokenId,
        address indexed invalidatedBy
    );

    constructor()
        ERC1155("https://api.kyc-kyb-platform.io/transaction/{id}.json")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(REGISTRAR_ROLE, msg.sender);
    }

    /**
     * @dev Register a single transaction proof
     * @param txHash Hash of the transaction data
     * @param txType Type of transaction
     * @param metadata Additional hashed metadata
     */
    function registerTransaction(
        bytes32 txHash,
        string memory txType,
        bytes32 metadata
    ) external returns (uint256) {
        require(txHash != bytes32(0), "Invalid transaction hash");
        require(txHashToToken[txHash] == 0, "Transaction already registered");

        uint256 tokenId = _nextTokenId;
        _nextTokenId++;

        transactions[tokenId] = TransactionData({
            txHash: txHash,
            txType: txType,
            metadata: metadata,
            registeredBy: msg.sender,
            timestamp: block.timestamp,
            isValid: true
        });

        txHashToToken[txHash] = tokenId;
        userTransactions[msg.sender].push(tokenId);

        // Mint one token to the registrant
        _mint(msg.sender, tokenId, 1, "");

        emit TransactionRegistered(
            tokenId,
            msg.sender,
            txHash,
            txType,
            block.timestamp
        );
        return tokenId;
    }

    /**
     * @dev Register multiple transactions in a batch (efficient)
     * @param txHashes Array of transaction hashes
     * @param txTypes Array of transaction types
     * @param metadatas Array of metadata hashes
     */
    function batchRegisterTransactions(
        bytes32[] memory txHashes,
        string[] memory txTypes,
        bytes32[] memory metadatas
    ) external returns (uint256[] memory) {
        require(
            txHashes.length == txTypes.length &&
                txTypes.length == metadatas.length,
            "Array length mismatch"
        );
        require(txHashes.length > 0, "Empty arrays");

        uint256[] memory tokenIds = new uint256[](txHashes.length);
        uint256[] memory amounts = new uint256[](txHashes.length);

        for (uint256 i = 0; i < txHashes.length; i++) {
            require(txHashes[i] != bytes32(0), "Invalid transaction hash");
            require(
                txHashToToken[txHashes[i]] == 0,
                "Transaction already registered"
            );

            uint256 tokenId = _nextTokenId;
            _nextTokenId++;

            tokenIds[i] = tokenId;
            amounts[i] = 1;

            transactions[tokenId] = TransactionData({
                txHash: txHashes[i],
                txType: txTypes[i],
                metadata: metadatas[i],
                registeredBy: msg.sender,
                timestamp: block.timestamp,
                isValid: true
            });

            txHashToToken[txHashes[i]] = tokenId;
            userTransactions[msg.sender].push(tokenId);
        }

        _mintBatch(msg.sender, tokenIds, amounts, "");

        emit TransactionBatchRegistered(tokenIds, msg.sender, txHashes.length);
        return tokenIds;
    }

    /**
     * @dev Verify if a transaction exists on-chain
     * @param txHash Hash of the transaction to verify
     */
    function verifyTransaction(
        bytes32 txHash
    ) external view returns (bool exists, uint256 tokenId, bool isValid) {
        uint256 tid = txHashToToken[txHash];
        if (tid == 0) return (false, 0, false);

        TransactionData memory txData = transactions[tid];
        return (true, tid, txData.isValid);
    }

    /**
     * @dev Get transaction details by token ID
     * @param tokenId ID of the transaction token
     */
    function getTransactionDetails(
        uint256 tokenId
    )
        external
        view
        returns (
            bytes32 txHash,
            string memory txType,
            bytes32 metadata,
            address registeredBy,
            uint256 timestamp,
            bool isValid
        )
    {
        TransactionData memory txData = transactions[tokenId];
        require(
            txData.registeredBy != address(0),
            "Transaction does not exist"
        );

        return (
            txData.txHash,
            txData.txType,
            txData.metadata,
            txData.registeredBy,
            txData.timestamp,
            txData.isValid
        );
    }

    /**
     * @dev Get all transaction token IDs for a user
     * @param user Address of the user
     */
    function getUserTransactions(
        address user
    ) external view returns (uint256[] memory) {
        return userTransactions[user];
    }

    /**
     * @dev Invalidate a transaction (admin/registrar only)
     * @param tokenId ID of the transaction to invalidate
     */
    function invalidateTransaction(
        uint256 tokenId
    ) external onlyRole(REGISTRAR_ROLE) {
        TransactionData storage txData = transactions[tokenId];
        require(
            txData.registeredBy != address(0),
            "Transaction does not exist"
        );
        require(txData.isValid, "Transaction already invalidated");

        txData.isValid = false;

        emit TransactionInvalidated(tokenId, msg.sender);
    }

    /**
     * @dev Update URI for metadata
     * @param newuri New URI string
     */
    function setURI(
        string memory newuri
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _setURI(newuri);
    }

    /**
     * @dev See {IERC165-supportsInterface}
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC1155, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
