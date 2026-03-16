const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("DocumentSignatureRegistry", function () {
    let registry;
    let owner, registrar, user1;

    beforeEach(async function () {
        [owner, registrar, user1] = await ethers.getSigners();

        const DocumentSignatureRegistry = await ethers.getContractFactory("DocumentSignatureRegistry");
        registry = await DocumentSignatureRegistry.deploy();
        await registry.waitForDeployment();

        // Grant REGISTRAR_ROLE to registrar
        const REGISTRAR_ROLE = await registry.REGISTRAR_ROLE();
        await registry.grantRole(REGISTRAR_ROLE, registrar.address);
    });

    describe("Deployment", function () {
        it("Should grant DEFAULT_ADMIN_ROLE and REGISTRAR_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
            const REGISTRAR_ROLE = await registry.REGISTRAR_ROLE();

            expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await registry.hasRole(REGISTRAR_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Complete Envelope", function () {
        it("Should complete an envelope successfully", async function () {
            const envelopeId = ethers.keccak256(ethers.toUtf8Bytes("envelope_1"));
            const docHash = ethers.keccak256(ethers.toUtf8Bytes("document_content"));
            const signers = [user1.address, owner.address];
            const finalCID = "QmTestCID123abc";

            await expect(
                registry.connect(registrar).completeEnvelope(envelopeId, docHash, signers, finalCID)
            ).to.emit(registry, "EnvelopeCompleted");

            // Verify stored data
            const envelope = await registry.getEnvelope(envelopeId);
            expect(envelope.documentHash).to.equal(docHash);
            expect(envelope.signers.length).to.equal(2);
            expect(envelope.signers[0]).to.equal(user1.address);
            expect(envelope.signers[1]).to.equal(owner.address);
            expect(envelope.finalCID).to.equal(finalCID);
            expect(envelope.exists).to.be.true;
            expect(envelope.completedAt).to.be.gt(0);
        });

        it("Should fail with invalid envelope ID (zero)", async function () {
            const docHash = ethers.keccak256(ethers.toUtf8Bytes("doc"));

            await expect(
                registry.connect(registrar).completeEnvelope(
                    ethers.ZeroHash, docHash, [user1.address], "CID"
                )
            ).to.be.revertedWith("Invalid envelopeId");
        });

        it("Should fail with invalid document hash (zero)", async function () {
            const envelopeId = ethers.keccak256(ethers.toUtf8Bytes("env"));

            await expect(
                registry.connect(registrar).completeEnvelope(
                    envelopeId, ethers.ZeroHash, [user1.address], "CID"
                )
            ).to.be.revertedWith("Invalid documentHash");
        });

        it("Should fail with no signers", async function () {
            const envelopeId = ethers.keccak256(ethers.toUtf8Bytes("env_no_sig"));
            const docHash = ethers.keccak256(ethers.toUtf8Bytes("doc"));

            await expect(
                registry.connect(registrar).completeEnvelope(
                    envelopeId, docHash, [], "CID"
                )
            ).to.be.revertedWith("No signers");
        });

        it("Should prevent duplicate completion (same envelope ID)", async function () {
            const envelopeId = ethers.keccak256(ethers.toUtf8Bytes("dup_envelope"));
            const docHash = ethers.keccak256(ethers.toUtf8Bytes("doc"));

            await registry.connect(registrar).completeEnvelope(
                envelopeId, docHash, [user1.address], "CID1"
            );

            await expect(
                registry.connect(registrar).completeEnvelope(
                    envelopeId, docHash, [user1.address], "CID2"
                )
            ).to.be.revertedWith("Already completed");
        });

        it("Should fail if caller does not have REGISTRAR_ROLE", async function () {
            const envelopeId = ethers.keccak256(ethers.toUtf8Bytes("no_role_env"));
            const docHash = ethers.keccak256(ethers.toUtf8Bytes("doc"));

            await expect(
                registry.connect(user1).completeEnvelope(
                    envelopeId, docHash, [user1.address], "CID"
                )
            ).to.be.reverted;
        });
    });

    describe("Get Envelope", function () {
        it("Should return correct data for completed envelope", async function () {
            const envelopeId = ethers.keccak256(ethers.toUtf8Bytes("get_env"));
            const docHash = ethers.keccak256(ethers.toUtf8Bytes("get_doc"));

            await registry.connect(registrar).completeEnvelope(
                envelopeId, docHash, [user1.address, registrar.address], "QmGetCID"
            );

            const envelope = await registry.getEnvelope(envelopeId);
            expect(envelope.exists).to.be.true;
            expect(envelope.documentHash).to.equal(docHash);
            expect(envelope.finalCID).to.equal("QmGetCID");
            expect(envelope.signers.length).to.equal(2);
        });

        it("Should return exists=false for non-existent envelope", async function () {
            const fakeId = ethers.keccak256(ethers.toUtf8Bytes("non_existent"));
            const envelope = await registry.getEnvelope(fakeId);
            expect(envelope.exists).to.be.false;
        });

        it("Should support empty finalCID", async function () {
            const envelopeId = ethers.keccak256(ethers.toUtf8Bytes("empty_cid_env"));
            const docHash = ethers.keccak256(ethers.toUtf8Bytes("doc"));

            await registry.connect(registrar).completeEnvelope(
                envelopeId, docHash, [user1.address], ""
            );

            const envelope = await registry.getEnvelope(envelopeId);
            expect(envelope.exists).to.be.true;
            expect(envelope.finalCID).to.equal("");
        });
    });
});
