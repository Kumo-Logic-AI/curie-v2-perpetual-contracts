import { MockContract, smockit } from "@eth-optimism/smock"
import { ethers } from "hardhat"
import { BaseToken, UniswapV3Factory, UniswapV3Pool } from "../../typechain"
import { VirtualToken } from "../../typechain/VirtualToken"
import { isAscendingTokenOrder } from "./utilities"

interface TokensFixture {
    token0: BaseToken
    token1: VirtualToken
    mockedAggregator0: MockContract
}

interface PoolFixture {
    factory: UniswapV3Factory
    pool: UniswapV3Pool
    baseToken: BaseToken
    quoteToken: VirtualToken
}

interface BaseTokenFixture {
    baseToken: BaseToken
    mockedAggregator: MockContract
}

export function createVirtualTokenFixture(name: string, symbol: string): () => Promise<VirtualToken> {
    return async (): Promise<VirtualToken> => {
        const virtualTokenFactory = await ethers.getContractFactory("VirtualToken")
        return (await virtualTokenFactory.deploy(name, symbol)) as VirtualToken
    }
}

export function createBaseTokenFixture(name: string, symbol: string): () => Promise<BaseTokenFixture> {
    return async (): Promise<BaseTokenFixture> => {
        const aggregatorFactory = await ethers.getContractFactory("TestAggregatorV3")
        const aggregator = await aggregatorFactory.deploy()
        const mockedAggregator = await smockit(aggregator)

        mockedAggregator.smocked.decimals.will.return.with(async () => {
            return 6
        })

        const chainlinkPriceFeedFactory = await ethers.getContractFactory("ChainlinkPriceFeed")
        const chainlinkPriceFeed = await chainlinkPriceFeedFactory.deploy(mockedAggregator.address)

        const baseTokenFactory = await ethers.getContractFactory("BaseToken")
        const baseToken = (await baseTokenFactory.deploy(name, symbol, chainlinkPriceFeed.address)) as BaseToken

        return { baseToken, mockedAggregator }
    }
}

export async function uniswapV3FactoryFixture(): Promise<UniswapV3Factory> {
    const factoryFactory = await ethers.getContractFactory("UniswapV3Factory")
    return (await factoryFactory.deploy()) as UniswapV3Factory
}

// assume isAscendingTokensOrder() == true/ token0 < token1
export async function tokensFixture(): Promise<TokensFixture> {
    const quoteToken = await createVirtualTokenFixture("RandomVirtualToken", "RVT")()
    const { baseToken, mockedAggregator } = await token0Fixture(quoteToken.address)

    return { token0: baseToken, token1: quoteToken, mockedAggregator0: mockedAggregator }
}

export async function token0Fixture(token1Addr: string): Promise<BaseTokenFixture> {
    let token0Fixture: BaseTokenFixture
    while (!token0Fixture || !isAscendingTokenOrder(token0Fixture.baseToken.address, token1Addr)) {
        token0Fixture = await createBaseTokenFixture("RandomTestToken0", "randomToken0")()
    }
    return token0Fixture
}

export async function base0Quote1PoolFixture(): Promise<PoolFixture> {
    const { token0, token1 } = await tokensFixture()
    const factory = await uniswapV3FactoryFixture()

    const tx = await factory.createPool(token0.address, token1.address, "10000")
    const receipt = await tx.wait()
    const poolAddress = receipt.events?.[0].args?.pool as string

    const poolFactory = await ethers.getContractFactory("UniswapV3Pool")
    const pool = poolFactory.attach(poolAddress) as UniswapV3Pool

    return { factory, pool, baseToken: token0, quoteToken: token1 }
}
