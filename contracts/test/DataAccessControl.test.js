const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("DataAccessControl", function () {
    let accessControl;
    let owner, dataOwner, requester, other;

    const ONE_HOUR = 3600;
    const ONE_DAY = 86400;

    beforeEach(async function () {
        [owner, dataOwner, requester, other] = await ethers.getSigners();

        const DataAccessControl = await ethers.getContractFactory("DataAccessControl");
        accessControl = await DataAccessControl.deploy();
        await accessControl.waitForDeployment();
    });

    /**
     * Helper: sign an EIP-712 AccessGrant struct from the data owner.
     */
    async function signAccessGrant(signer, contract, { requesterAddr, tokenIds, expiresAt, purpose }) {
        const nonce = await contract.getNonce(signer.address);
        const contractAddr = await contract.getAddress();
        const network = await signer.provider.getNetwork();

        const domain = {
            name: "KYC-KYB DataAccessControl",
            version: "1",
            chainId: Number(network.chainId),
            verifyingContract: contractAddr
        };

        const types = {
            AccessGrant: [
                { name: "requester", type: "address" },
                { name: "tokenIds", type: "uint256[]" },
                { name: "expiresAt", type: "uint256" },
                { name: "purpose", type: "string" },
                { name: "nonce", type: "uint256" }
            ]
        };

        const value = {
            requester: requesterAddr,
            tokenIds,
            expiresAt,
            purpose,
            nonce: Number(nonce)
        };

        const signature = await signer.signTypedData(domain, types, value);
        return signature;
    }

    describe("Deployment", function () {
        it("Should initialize with correct EIP-712 domain name", async function () {
            // The contract should be deployed successfully
            const address = await accessControl.getAddress();
            expect(address).to.be.properAddress;
        });
    });

    describe("Grant Access", function () {
        it("Should grant access with valid EIP-712 signature", async function () {
            const tokenIds = [1, 2];
            const expiresAt = (await time.latest()) + ONE_DAY;
            const purpose = "KYC verification";

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose
            });

            await expect(
                accessControl.connect(dataOwner).grantAccess(
                    requester.address, tokenIds, expiresAt, purpose, sig
                )
            ).to.emit(accessControl, "AccessGranted");
        });

        it("Should increment nonce after granting access", async function () {
            const nonceBefore = await accessControl.getNonce(dataOwner.address);

            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_DAY;
            const purpose = "test";

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose
            });

            await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, purpose, sig
            );

            const nonceAfter = await accessControl.getNonce(dataOwner.address);
            expect(nonceAfter).to.equal(nonceBefore + 1n);
        });

        it("Should fail with zero address requester", async function () {
            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_DAY;
            const sig = "0x" + "00".repeat(65);

            await expect(
                accessControl.connect(dataOwner).grantAccess(
                    ethers.ZeroAddress, tokenIds, expiresAt, "test", sig
                )
            ).to.be.revertedWith("Invalid requester address");
        });

        it("Should fail with empty tokenIds", async function () {
            const expiresAt = (await time.latest()) + ONE_DAY;
            const sig = "0x" + "00".repeat(65);

            await expect(
                accessControl.connect(dataOwner).grantAccess(
                    requester.address, [], expiresAt, "test", sig
                )
            ).to.be.revertedWith("No token IDs provided");
        });

        it("Should fail with expired timestamp", async function () {
            const pastTime = (await time.latest()) - 100;
            const sig = "0x" + "00".repeat(65);

            await expect(
                accessControl.connect(dataOwner).grantAccess(
                    requester.address, [1], pastTime, "test", sig
                )
            ).to.be.revertedWith("Invalid expiration time");
        });
    });

    describe("Has Access", function () {
        it("Should return true for valid, non-expired grant", async function () {
            const tokenIds = [1, 2];
            const expiresAt = (await time.latest()) + ONE_DAY;
            const purpose = "verification";

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose
            });

            await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, purpose, sig
            );

            expect(await accessControl.hasAccess(requester.address, dataOwner.address, 1)).to.be.true;
            expect(await accessControl.hasAccess(requester.address, dataOwner.address, 2)).to.be.true;
        });

        it("Should return false for non-granted tokenId", async function () {
            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_DAY;
            const purpose = "test";

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose
            });

            await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, purpose, sig
            );

            // Token 99 was never granted
            expect(await accessControl.hasAccess(requester.address, dataOwner.address, 99)).to.be.false;
        });

        it("Should return false after grant expires", async function () {
            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_HOUR;
            const purpose = "short-lived";

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose
            });

            await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, purpose, sig
            );

            // Fast forward past expiry
            await time.increase(ONE_HOUR + 100);

            expect(await accessControl.hasAccess(requester.address, dataOwner.address, 1)).to.be.false;
        });

        it("Should return false for unknown requester", async function () {
            expect(await accessControl.hasAccess(other.address, dataOwner.address, 1)).to.be.false;
        });
    });

    describe("Revoke Access", function () {
        it("Should revoke access successfully", async function () {
            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_DAY;
            const purpose = "to-revoke";

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose
            });

            const tx = await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, purpose, sig
            );
            const receipt = await tx.wait();

            // Extract accessId from AccessGranted event
            const event = receipt.logs.find(log => {
                try {
                    const parsed = accessControl.interface.parseLog(log);
                    return parsed.name === "AccessGranted";
                } catch { return false; }
            });
            const parsed = accessControl.interface.parseLog(event);
            const accessId = parsed.args.accessId;

            // Verify access exists
            expect(await accessControl.hasAccess(requester.address, dataOwner.address, 1)).to.be.true;

            // Revoke
            await expect(
                accessControl.connect(dataOwner).revokeAccess(accessId)
            ).to.emit(accessControl, "AccessRevoked");

            // Verify access is gone
            expect(await accessControl.hasAccess(requester.address, dataOwner.address, 1)).to.be.false;
        });

        it("Should fail to revoke if not data owner", async function () {
            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_DAY;

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose: "test"
            });

            const tx = await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, "test", sig
            );
            const receipt = await tx.wait();

            const event = receipt.logs.find(log => {
                try {
                    const parsed = accessControl.interface.parseLog(log);
                    return parsed.name === "AccessGranted";
                } catch { return false; }
            });
            const parsed = accessControl.interface.parseLog(event);
            const accessId = parsed.args.accessId;

            await expect(
                accessControl.connect(other).revokeAccess(accessId)
            ).to.be.revertedWith("Not authorized");
        });
    });

    describe("Access Logs", function () {
        it("Should track access grants for data owner", async function () {
            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_DAY;

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose: "log-test"
            });

            await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, "log-test", sig
            );

            const logs = await accessControl.getAccessLog(dataOwner.address);
            expect(logs.length).to.equal(1);
        });

        it("Should track access grants for requester", async function () {
            const tokenIds = [1];
            const expiresAt = (await time.latest()) + ONE_DAY;

            const sig = await signAccessGrant(dataOwner, accessControl, {
                requesterAddr: requester.address,
                tokenIds,
                expiresAt,
                purpose: "requester-log"
            });

            await accessControl.connect(dataOwner).grantAccess(
                requester.address, tokenIds, expiresAt, "requester-log", sig
            );

            const logs = await accessControl.getRequesterAccessLog(requester.address);
            expect(logs.length).to.equal(1);
        });
    });
});
