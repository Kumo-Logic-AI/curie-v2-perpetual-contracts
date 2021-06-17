import { expect } from "chai"
import { Wallet } from "ethers"
import { waffle } from "hardhat"
import { ClearingHouse, TestERC20 } from "../../typechain"
import { toWei } from "../helper/number"
import { clearingHouseFixture } from "./fixtures"

describe("ClearingHouse", () => {
    const admin: Wallet = waffle.provider.getWallets()[0]
    const alice: Wallet = waffle.provider.getWallets()[1]
    let clearingHouse: ClearingHouse
    let collateral: TestERC20

    beforeEach(async () => {
        const _clearingHouseFixture = await waffle.loadFixture(clearingHouseFixture)
        clearingHouse = _clearingHouseFixture.clearingHouse
        collateral = _clearingHouseFixture.USDC

        // mint
        collateral.mint(admin.address, toWei(10000))
    })

    describe("# deposit", () => {
        let aliceInitCollateralBalance = 1000

        beforeEach(async () => {
            const amount = toWei(aliceInitCollateralBalance, await collateral.decimals())
            await collateral.transfer(alice.address, amount)
            await collateral.connect(alice).approve(clearingHouse.address, amount)
        })

        // @SAMPLE - deposit
        it("alice deposit and sends an event", async () => {
            const amount = toWei(100, await collateral.decimals())

            // check event has been sent
            await expect(clearingHouse.connect(alice).deposit(amount))
                .to.emit(clearingHouse, "Deposited")
                .withArgs(collateral.address, alice.address, amount)

            // check collateral status
            expect(await clearingHouse.getCollateral(alice.address)).to.eq(amount)

            // check alice balance
            expect(await collateral.balanceOf(alice.address)).to.eq(toWei(900, await collateral.decimals()))
        })

        // TODO should we test against potential attack using EIP777?
    })
})
