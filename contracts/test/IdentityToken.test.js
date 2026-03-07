const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("IdentityToken", function () {
    let identityToken;
    let owner, verifier, user1, user2;
    const ONE_YEAR = 365 * 24 * 60 * 60;

    beforeEach(async function () {
        [owner, verifier, user1, user2] = await ethers.getSigners();

        const IdentityToken = await ethers.getContractFactory("IdentityToken");
        identityToken = await IdentityToken.deploy();
        await identityToken.waitForDeployment();

        // Grant verifier role
        const VERIFIER_ROLE = await identityToken.VERIFIER_ROLE();
        await identityToken.grantRole(VERIFIER_ROLE, verifier.address);
    });

    describe("Deployment", function () {
        it("Should set the correct name and symbol", async function () {
            expect(await identityToken.name()).to.equal("KYC/KYB Identity Token");
            expect(await identityToken.symbol()).to.equal("KYCKYB");
        });

        it("Should grant DEFAULT_ADMIN_ROLE and VERIFIER_ROLE to deployer", async function () {
            const DEFAULT_ADMIN_ROLE = await identityToken.DEFAULT_ADMIN_ROLE();
            const VERIFIER_ROLE = await identityToken.VERIFIER_ROLE();

            expect(await identityToken.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
            expect(await identityToken.hasRole(VERIFIER_ROLE, owner.address)).to.be.true;
        });
    });

    describe("Minting Identity Tokens", function () {
        it("Should mint a new identity token successfully", async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await expect(
                identityToken.connect(verifier).mintIdentityToken(
                    user1.address,
                    dataHash,
                    "KYC",
                    expiryDate
                )
            ).to.emit(identityToken, "IdentityMinted");

            const tokenId = await identityToken.userToToken(user1.address);
            expect(tokenId).to.equal(1);
        });

        it("Should fail if user already has a token", async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await identityToken.connect(verifier).mintIdentityToken(
                user1.address,
                dataHash,
                "KYC",
                expiryDate
            );

            await expect(
                identityToken.connect(verifier).mintIdentityToken(
                    user1.address,
                    dataHash,
                    "KYC",
                    expiryDate
                )
            ).to.be.revertedWith("User already has identity token");
        });

        it("Should fail if not called by verifier", async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await expect(
                identityToken.connect(user1).mintIdentityToken(
                    user2.address,
                    dataHash,
                    "KYC",
                    expiryDate
                )
            ).to.be.reverted;
        });

        it("Should fail with invalid expiry date", async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const pastDate = (await time.latest()) - 1000;

            await expect(
                identityToken.connect(verifier).mintIdentityToken(
                    user1.address,
                    dataHash,
                    "KYC",
                    pastDate
                )
            ).to.be.revertedWith("Invalid expiry date");
        });
    });

    describe("Soulbound Properties", function () {
        beforeEach(async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await identityToken.connect(verifier).mintIdentityToken(
                user1.address,
                dataHash,
                "KYC",
                expiryDate
            );
        });

        it("Should prevent transfers", async function () {
            const tokenId = await identityToken.userToToken(user1.address);

            await expect(
                identityToken.connect(user1).transferFrom(user1.address, user2.address, tokenId)
            ).to.be.revertedWithCustomError(identityToken, "ERC721InvalidSender");
        });

        it("Should prevent approvals", async function () {
            const tokenId = await identityToken.userToToken(user1.address);

            await expect(
                identityToken.connect(user1).approve(user2.address, tokenId)
            ).to.be.revertedWith("Soulbound: Approval not allowed");
        });

        it("Should prevent setApprovalForAll", async function () {
            await expect(
                identityToken.connect(user1).setApprovalForAll(user2.address, true)
            ).to.be.revertedWith("Soulbound: Approval not allowed");
        });
    });

    describe("Token Revocation", function () {
        let tokenId;

        beforeEach(async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await identityToken.connect(verifier).mintIdentityToken(
                user1.address,
                dataHash,
                "KYC",
                expiryDate
            );

            tokenId = await identityToken.userToToken(user1.address);
        });

        it("Should revoke a token successfully", async function () {
            await expect(
                identityToken.connect(verifier).revokeToken(tokenId)
            ).to.emit(identityToken, "IdentityRevoked");

            const metadata = await identityToken.getTokenMetadata(tokenId);
            expect(metadata[5]).to.be.true; // isRevoked
        });

        it("Should fail to revoke non-existent token", async function () {
            await expect(
                identityToken.connect(verifier).revokeToken(999)
            ).to.be.reverted;
        });

        it("Should fail to revoke already revoked token", async function () {
            await identityToken.connect(verifier).revokeToken(tokenId);

            await expect(
                identityToken.connect(verifier).revokeToken(tokenId)
            ).to.be.revertedWith("Token already revoked");
        });
    });

    describe("Token Updates", function () {
        let tokenId;

        beforeEach(async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await identityToken.connect(verifier).mintIdentityToken(
                user1.address,
                dataHash,
                "KYC",
                expiryDate
            );

            tokenId = await identityToken.userToToken(user1.address);
        });

        it("Should update identity data successfully", async function () {
            const newDataHash = ethers.keccak256(ethers.toUtf8Bytes("new_encrypted_data"));
            const newExpiryDate = (await time.latest()) + (2 * ONE_YEAR);

            await expect(
                identityToken.connect(verifier).updateIdentity(tokenId, newDataHash, newExpiryDate)
            ).to.emit(identityToken, "IdentityUpdated");

            const metadata = await identityToken.getTokenMetadata(tokenId);
            expect(metadata[0]).to.equal(newDataHash);
        });

        it("Should fail to update revoked token", async function () {
            await identityToken.connect(verifier).revokeToken(tokenId);

            const newDataHash = ethers.keccak256(ethers.toUtf8Bytes("new_encrypted_data"));
            const newExpiryDate = (await time.latest()) + (2 * ONE_YEAR);

            await expect(
                identityToken.connect(verifier).updateIdentity(tokenId, newDataHash, newExpiryDate)
            ).to.be.revertedWith("Token is revoked");
        });
    });

    describe("Verification Status", function () {
        it("Should return false for non-verified user", async function () {
            expect(await identityToken.isVerified(user1.address)).to.be.false;
        });

        it("Should return true for verified user with valid token", async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await identityToken.connect(verifier).mintIdentityToken(
                user1.address,
                dataHash,
                "KYC",
                expiryDate
            );

            expect(await identityToken.isVerified(user1.address)).to.be.true;
        });

        it("Should return false for revoked token", async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + ONE_YEAR;

            await identityToken.connect(verifier).mintIdentityToken(
                user1.address,
                dataHash,
                "KYC",
                expiryDate
            );

            const tokenId = await identityToken.userToToken(user1.address);
            await identityToken.connect(verifier).revokeToken(tokenId);

            expect(await identityToken.isVerified(user1.address)).to.be.false;
        });

        it("Should return false for expired token", async function () {
            const dataHash = ethers.keccak256(ethers.toUtf8Bytes("encrypted_data"));
            const expiryDate = (await time.latest()) + 1000; // Expires in 1000 seconds

            await identityToken.connect(verifier).mintIdentityToken(
                user1.address,
                dataHash,
                "KYC",
                expiryDate
            );

            // Fast forward time
            await time.increase(2000);

            expect(await identityToken.isVerified(user1.address)).to.be.false;
        });
    });
});
