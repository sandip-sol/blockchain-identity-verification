const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TransactionRegistry", function () {
    let transactionRegistry;
    let owner, user1, user2;

    beforeEach(async function () {
        [owner, user1, user2] = await ethers.getSigners();

        const TransactionRegistry = await ethers.getContractFactory("TransactionRegistry");
        transactionRegistry = await TransactionRegistry.deploy();
        await transactionRegistry.waitForDeployment();
    });

    describe("Deployment", function () {
        it("Should grant DEFAULT_ADMIN_ROLE and REGISTRAR_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await transactionRegistry.DEFAULT_ADMIN_ROLE();
            const REGISTRAR_ROLE = await transactionRegistry.REGISTRAR_ROLE();

            expect(await transactionRegistry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await transactionRegistry.hasRole(REGISTRAR_ROLE, owner.address)).to.be.true;
        });

        it("Should support ERC1155 and AccessControl interfaces", async function () {
            // ERC1155 interface ID
            expect(await transactionRegistry.supportsInterface("0xd9b67a26")).to.be.true;
        });
    });

    describe("Register Transaction", function () {
        it("Should register a single transaction successfully", async function () {
            const txHash = ethers.keccak256(ethers.toUtf8Bytes("tx_data_1"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("metadata_1"));

            await expect(
                transactionRegistry.connect(user1).registerTransaction(txHash, "payment", metadata)
            ).to.emit(transactionRegistry, "TransactionRegistered");

            const tokenId = await transactionRegistry.txHashToToken(txHash);
            expect(tokenId).to.equal(1);

            // Check transaction details
            const details = await transactionRegistry.getTransactionDetails(tokenId);
            expect(details.txHash).to.equal(txHash);
            expect(details.txType).to.equal("payment");
            expect(details.metadata).to.equal(metadata);
            expect(details.registeredBy).to.equal(user1.address);
            expect(details.isValid).to.be.true;
        });

        it("Should mint an ERC1155 token to the registrant", async function () {
            const txHash = ethers.keccak256(ethers.toUtf8Bytes("tx_data_2"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("metadata_2"));

            await transactionRegistry.connect(user1).registerTransaction(txHash, "invoice", metadata);
            const tokenId = await transactionRegistry.txHashToToken(txHash);

            expect(await transactionRegistry.balanceOf(user1.address, tokenId)).to.equal(1);
        });

        it("Should fail to register duplicate transaction hash", async function () {
            const txHash = ethers.keccak256(ethers.toUtf8Bytes("tx_data_dup"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("metadata_dup"));

            await transactionRegistry.connect(user1).registerTransaction(txHash, "payment", metadata);

            await expect(
                transactionRegistry.connect(user2).registerTransaction(txHash, "transfer", metadata)
            ).to.be.revertedWith("Transaction already registered");
        });

        it("Should fail with zero transaction hash", async function () {
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("metadata"));

            await expect(
                transactionRegistry.connect(user1).registerTransaction(ethers.ZeroHash, "payment", metadata)
            ).to.be.revertedWith("Invalid transaction hash");
        });

        it("Should track user transactions", async function () {
            const txHash1 = ethers.keccak256(ethers.toUtf8Bytes("user_tx_1"));
            const txHash2 = ethers.keccak256(ethers.toUtf8Bytes("user_tx_2"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("metadata"));

            await transactionRegistry.connect(user1).registerTransaction(txHash1, "payment", metadata);
            await transactionRegistry.connect(user1).registerTransaction(txHash2, "invoice", metadata);

            const userTxs = await transactionRegistry.getUserTransactions(user1.address);
            expect(userTxs.length).to.equal(2);
        });
    });

    describe("Batch Register Transactions", function () {
        it("Should batch register multiple transactions", async function () {
            const txHashes = [
                ethers.keccak256(ethers.toUtf8Bytes("batch_1")),
                ethers.keccak256(ethers.toUtf8Bytes("batch_2")),
                ethers.keccak256(ethers.toUtf8Bytes("batch_3"))
            ];
            const txTypes = ["payment", "invoice", "transfer"];
            const metadatas = txHashes.map((_, i) =>
                ethers.keccak256(ethers.toUtf8Bytes(`meta_${i}`))
            );

            await expect(
                transactionRegistry.connect(user1).batchRegisterTransactions(txHashes, txTypes, metadatas)
            ).to.emit(transactionRegistry, "TransactionBatchRegistered");

            // Verify all were registered
            for (const txHash of txHashes) {
                const tokenId = await transactionRegistry.txHashToToken(txHash);
                expect(tokenId).to.be.gt(0);
            }
        });

        it("Should fail with mismatched array lengths", async function () {
            const txHashes = [ethers.keccak256(ethers.toUtf8Bytes("a"))];
            const txTypes = ["payment", "invoice"]; // mismatch
            const metadatas = [ethers.keccak256(ethers.toUtf8Bytes("m"))];

            await expect(
                transactionRegistry.connect(user1).batchRegisterTransactions(txHashes, txTypes, metadatas)
            ).to.be.revertedWith("Array length mismatch");
        });

        it("Should fail with empty arrays", async function () {
            await expect(
                transactionRegistry.connect(user1).batchRegisterTransactions([], [], [])
            ).to.be.revertedWith("Empty arrays");
        });
    });

    describe("Verify Transaction", function () {
        it("Should verify an existing transaction", async function () {
            const txHash = ethers.keccak256(ethers.toUtf8Bytes("verify_tx"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("meta"));

            await transactionRegistry.connect(user1).registerTransaction(txHash, "payment", metadata);

            const [exists, tokenId, isValid] = await transactionRegistry.verifyTransaction(txHash);
            expect(exists).to.be.true;
            expect(tokenId).to.equal(1);
            expect(isValid).to.be.true;
        });

        it("Should return false for non-existent transaction", async function () {
            const fakeHash = ethers.keccak256(ethers.toUtf8Bytes("non_existent"));
            const [exists, ,] = await transactionRegistry.verifyTransaction(fakeHash);
            expect(exists).to.be.false;
        });
    });

    describe("Invalidate Transaction", function () {
        it("Should invalidate a transaction by REGISTRAR_ROLE", async function () {
            const txHash = ethers.keccak256(ethers.toUtf8Bytes("to_invalidate"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("meta"));

            await transactionRegistry.connect(user1).registerTransaction(txHash, "payment", metadata);
            const tokenId = await transactionRegistry.txHashToToken(txHash);

            await expect(
                transactionRegistry.connect(owner).invalidateTransaction(tokenId)
            ).to.emit(transactionRegistry, "TransactionInvalidated");

            const [exists, , isValid] = await transactionRegistry.verifyTransaction(txHash);
            expect(exists).to.be.true;
            expect(isValid).to.be.false;
        });

        it("Should fail if not REGISTRAR_ROLE", async function () {
            const txHash = ethers.keccak256(ethers.toUtf8Bytes("no_role"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("meta"));

            await transactionRegistry.connect(user1).registerTransaction(txHash, "payment", metadata);
            const tokenId = await transactionRegistry.txHashToToken(txHash);

            await expect(
                transactionRegistry.connect(user1).invalidateTransaction(tokenId)
            ).to.be.reverted;
        });

        it("Should fail to invalidate already invalid transaction", async function () {
            const txHash = ethers.keccak256(ethers.toUtf8Bytes("double_invalid"));
            const metadata = ethers.keccak256(ethers.toUtf8Bytes("meta"));

            await transactionRegistry.connect(user1).registerTransaction(txHash, "payment", metadata);
            const tokenId = await transactionRegistry.txHashToToken(txHash);

            await transactionRegistry.connect(owner).invalidateTransaction(tokenId);

            await expect(
                transactionRegistry.connect(owner).invalidateTransaction(tokenId)
            ).to.be.revertedWith("Transaction already invalidated");
        });
    });

    describe("URI Management", function () {
        it("Should allow admin to update URI", async function () {
            await transactionRegistry.connect(owner).setURI("https://new-uri.io/{id}.json");
            // No revert means success
        });

        it("Should fail if non-admin updates URI", async function () {
            await expect(
                transactionRegistry.connect(user1).setURI("https://hacked.io/{id}")
            ).to.be.reverted;
        });
    });
});
