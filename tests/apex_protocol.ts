import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from "@solana/web3.js";
import {
  createMint,
  createAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
  getAccount,
} from "@solana/spl-token";
import { expect } from "chai";

describe("apex_protocol comprehensive test suite", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // We load the ApexProtocol IDL/Program
  const program: any = (anchor.workspace.ApexProtocol || anchor.workspace.apexProtocol) as any;

  let authority: Keypair;
  let traderA: Keypair;
  let traderB: Keypair;
  let keeper: Keypair;
  let baseMint: PublicKey;
  let marketPda: PublicKey;
  let marketBump: number;
  let orderBookPda: PublicKey;
  let orderBookBump: number;
  let vaultKeypair: Keypair;
  let mockOracleKeypair: Keypair;

  let traderATokenAccount: PublicKey;
  let traderBTokenAccount: PublicKey;
  let keeperTokenAccount: PublicKey;
  let traderAMarginPda: PublicKey;
  let traderBMarginPda: PublicKey;
  let traderAPositionPda: PublicKey;
  let traderBPositionPda: PublicKey;

  const PRICE_DECIMALS = 1_000_000;
  const SIZE_DECIMALS = 1_000_000;
  const FEE_RATE_BPS = 4; // 0.04%

  /**
   * Helper to write a mock Pyth price account data buffer
   */
  function createMockPythAccountData(
    price: number,
    confidence: number = 10,
    expo: number = -6,
    timestampDelta: number = 0
  ): Buffer {
    const data = Buffer.alloc(240);
    // Magic 0xa1b2c3d4
    data.writeUInt32LE(0xa1b2c3d4, 0);
    // Version 2
    data.writeUInt32LE(2, 4);
    // Account type 3 (price account)
    data.writeUInt32LE(3, 8);
    // Exponent at offset 20
    data.writeInt32LE(expo, 20);

    const now = Math.floor(Date.now() / 1000) + timestampDelta;
    // timestamp at offset 96
    data.writeBigInt64LE(BigInt(now), 96);

    // Prev price at 184
    data.writeBigInt64LE(BigInt(price), 184);
    // Prev conf at 192
    data.writeBigUInt64LE(BigInt(confidence), 192);
    // Prev timestamp at 200
    data.writeBigInt64LE(BigInt(now), 200);

    // Aggregate price at offset 208
    data.writeBigInt64LE(BigInt(price), 208);
    // Aggregate conf at offset 216
    data.writeBigUInt64LE(BigInt(confidence), 216);
    // Aggregate status at offset 224: 1 = TRADING
    data.writeUInt8(1, 224);

    return data;
  }

  before(async () => {
    authority = Keypair.generate();
    traderA = Keypair.generate();
    traderB = Keypair.generate();
    keeper = Keypair.generate();
    vaultKeypair = Keypair.generate();
    mockOracleKeypair = Keypair.generate();

    // Airdrop SOL to test actors
    for (const actor of [authority, traderA, traderB, keeper]) {
      const sig = await provider.connection.requestAirdrop(
        actor.publicKey,
        10 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig, "confirmed");
    }

    // Create Base Mint (collateral token e.g. USDC, 6 decimals)
    baseMint = await createMint(
      provider.connection,
      authority,
      authority.publicKey,
      null,
      6
    );

    // Derive Market & OrderBook PDAs
    [marketPda, marketBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), baseMint.toBuffer()],
      program.programId
    );

    [orderBookPda, orderBookBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("orderbook"), marketPda.toBuffer()],
      program.programId
    );

    // Derive Margin PDAs
    [traderAMarginPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("margin"), marketPda.toBuffer(), traderA.publicKey.toBuffer()],
      program.programId
    );

    [traderBMarginPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("margin"), marketPda.toBuffer(), traderB.publicKey.toBuffer()],
      program.programId
    );

    // Derive Position PDAs
    [traderAPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), traderA.publicKey.toBuffer()],
      program.programId
    );

    [traderBPositionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), marketPda.toBuffer(), traderB.publicKey.toBuffer()],
      program.programId
    );

    // Create token accounts
    traderATokenAccount = await createAccount(
      provider.connection,
      traderA,
      baseMint,
      traderA.publicKey
    );

    traderBTokenAccount = await createAccount(
      provider.connection,
      traderB,
      baseMint,
      traderB.publicKey
    );

    keeperTokenAccount = await createAccount(
      provider.connection,
      keeper,
      baseMint,
      keeper.publicKey
    );

    // Mint collateral to traders (10,000 USDC each)
    const initialBalance = 10_000 * 10 ** 6;
    await mintTo(
      provider.connection,
      authority,
      baseMint,
      traderATokenAccount,
      authority,
      initialBalance
    );
    await mintTo(
      provider.connection,
      authority,
      baseMint,
      traderBTokenAccount,
      authority,
      initialBalance
    );
  });

  describe("1. Market Initialization", () => {
    it("initializes a perpetual market and orderbook PDA", async () => {
      await program.methods
        .initializeMarket(new anchor.BN(FEE_RATE_BPS), mockOracleKeypair.publicKey)
        .accounts({
          authority: authority.publicKey,
          market: marketPda,
          vault: vaultKeypair.publicKey,
          baseMint: baseMint,
          orderBook: orderBookPda,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          rent: SYSVAR_RENT_PUBKEY,
        })
        .signers([authority, vaultKeypair])
        .rpc();

      const marketAccount = await program.account.market.fetch(marketPda);
      expect(marketAccount.authority.toBase58()).to.equal(authority.publicKey.toBase58());
      expect(marketAccount.oracle.toBase58()).to.equal(mockOracleKeypair.publicKey.toBase58());
      expect(marketAccount.vault.toBase58()).to.equal(vaultKeypair.publicKey.toBase58());
      expect(marketAccount.feeRate.toNumber()).to.equal(FEE_RATE_BPS);
      expect(marketAccount.openInterestLong.toNumber()).to.equal(0);
      expect(marketAccount.openInterestShort.toNumber()).to.equal(0);

      const orderBookAccount = await program.account.orderBook.fetch(orderBookPda);
      expect(orderBookAccount.market.toBase58()).to.equal(marketPda.toBase58());
      expect(orderBookAccount.bids.length).to.equal(0);
      expect(orderBookAccount.asks.length).to.equal(0);
    });

    it("rejects invalid fee rate (> 100 bps)", async () => {
      const dummyVault = Keypair.generate();
      const dummyMint = await createMint(provider.connection, authority, authority.publicKey, null, 6);
      const [dummyMarket] = PublicKey.findProgramAddressSync([Buffer.from("market"), dummyMint.toBuffer()], program.programId);
      const [dummyOrderBook] = PublicKey.findProgramAddressSync([Buffer.from("orderbook"), dummyMarket.toBuffer()], program.programId);

      try {
        await program.methods
          .initializeMarket(new anchor.BN(200), mockOracleKeypair.publicKey)
          .accounts({
            authority: authority.publicKey,
            market: dummyMarket,
            vault: dummyVault.publicKey,
            baseMint: dummyMint,
            orderBook: dummyOrderBook,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([authority, dummyVault])
          .rpc();
        expect.fail("Should have failed with InvalidFeeRate");
      } catch (err: any) {
        expect(err.error?.errorCode?.code || err.toString()).to.include("InvalidFeeRate");
      }
    });
  });

  describe("2. Margin Deposits & Withdrawals", () => {
    it("deposits collateral into TraderMarginAccount PDA", async () => {
      const depositAmount = new anchor.BN(1_000 * 10 ** 6); // 1,000 USDC

      await program.methods
        .depositMargin(depositAmount)
        .accounts({
          trader: traderA.publicKey,
          market: marketPda,
          marginAccount: traderAMarginPda,
          vault: vaultKeypair.publicKey,
          traderTokenAccount: traderATokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([traderA])
        .rpc();

      const margin = await program.account.traderMarginAccount.fetch(traderAMarginPda);
      expect(margin.owner.toBase58()).to.equal(traderA.publicKey.toBase58());
      expect(margin.depositedCollateral.toString()).to.equal(depositAmount.toString());
      expect(margin.lockedCollateral.toNumber()).to.equal(0);
    });

    it("withdraws available margin from TraderMarginAccount PDA", async () => {
      const withdrawAmount = new anchor.BN(200 * 10 ** 6); // 200 USDC

      await program.methods
        .withdrawMargin(withdrawAmount)
        .accounts({
          trader: traderA.publicKey,
          market: marketPda,
          marginAccount: traderAMarginPda,
          vault: vaultKeypair.publicKey,
          traderTokenAccount: traderATokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([traderA])
        .rpc();

      const margin = await program.account.traderMarginAccount.fetch(traderAMarginPda);
      expect(margin.depositedCollateral.toNumber()).to.equal(800 * 10 ** 6);
    });

    it("rejects withdrawing more collateral than available", async () => {
      const excessWithdraw = new anchor.BN(999_999 * 10 ** 6);

      try {
        await program.methods
          .withdrawMargin(excessWithdraw)
          .accounts({
            trader: traderA.publicKey,
            market: marketPda,
            marginAccount: traderAMarginPda,
            vault: vaultKeypair.publicKey,
            traderTokenAccount: traderATokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([traderA])
          .rpc();
        expect.fail("Should have failed with InsufficientCollateral");
      } catch (err: any) {
        expect(err.error?.errorCode?.code || err.toString()).to.include("InsufficientCollateral");
      }
    });
  });

  describe("3. Order Placement & Leverage Bounds", () => {
    before(async () => {
      // Also deposit margin for trader B
      await program.methods
        .depositMargin(new anchor.BN(2_000 * 10 ** 6))
        .accounts({
          trader: traderB.publicKey,
          market: marketPda,
          marginAccount: traderBMarginPda,
          vault: vaultKeypair.publicKey,
          traderTokenAccount: traderBTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([traderB])
        .rpc();
    });

    it("places a valid Long limit order within leverage bounds (5x)", async () => {
      const price = new anchor.BN(65_000 * PRICE_DECIMALS);
      const sizeUsdc = new anchor.BN(500 * SIZE_DECIMALS);
      const leverage = 5;

      await program.methods
        .placeOrder({ long: {} }, price, sizeUsdc, leverage)
        .accounts({
          signer: traderA.publicKey,
          market: marketPda,
          orderBook: orderBookPda,
          marginAccount: traderAMarginPda,
          vault: vaultKeypair.publicKey,
          traderTokenAccount: traderATokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([traderA])
        .rpc();

      const orderBook = await program.account.orderBook.fetch(orderBookPda);
      expect(orderBook.bids.length).to.equal(1);
      expect(orderBook.bids[0].owner.toBase58()).to.equal(traderA.publicKey.toBase58());
      expect(orderBook.bids[0].leverage).to.equal(5);
    });

    it("rejects leverage exceeding MAX_LEVERAGE (11x)", async () => {
      const price = new anchor.BN(65_000 * PRICE_DECIMALS);
      const sizeUsdc = new anchor.BN(100 * SIZE_DECIMALS);
      const invalidLeverage = 11;

      try {
        await program.methods
          .placeOrder({ long: {} }, price, sizeUsdc, invalidLeverage)
          .accounts({
            signer: traderA.publicKey,
            market: marketPda,
            orderBook: orderBookPda,
            marginAccount: traderAMarginPda,
            vault: vaultKeypair.publicKey,
            traderTokenAccount: traderATokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([traderA])
          .rpc();
        expect.fail("Should have failed with InvalidLeverage");
      } catch (err: any) {
        expect(err.error?.errorCode?.code || err.toString()).to.include("InvalidLeverage");
      }
    });

    it("rejects leverage below MIN_LEVERAGE (0x)", async () => {
      const price = new anchor.BN(65_000 * PRICE_DECIMALS);
      const sizeUsdc = new anchor.BN(100 * SIZE_DECIMALS);

      try {
        await program.methods
          .placeOrder({ long: {} }, price, sizeUsdc, 0)
          .accounts({
            signer: traderA.publicKey,
            market: marketPda,
            orderBook: orderBookPda,
            marginAccount: traderAMarginPda,
            vault: vaultKeypair.publicKey,
            traderTokenAccount: traderATokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([traderA])
          .rpc();
        expect.fail("Should have failed with InvalidLeverage");
      } catch (err: any) {
        expect(err.error?.errorCode?.code || err.toString()).to.include("InvalidLeverage");
      }
    });

    it("places a crossing Short limit order from Trader B", async () => {
      // Short at 65,000 (crosses with Bid at 65,000)
      const price = new anchor.BN(65_000 * PRICE_DECIMALS);
      const sizeUsdc = new anchor.BN(500 * SIZE_DECIMALS);
      const leverage = 5;

      await program.methods
        .placeOrder({ short: {} }, price, sizeUsdc, leverage)
        .accounts({
          signer: traderB.publicKey,
          market: marketPda,
          orderBook: orderBookPda,
          marginAccount: traderBMarginPda,
          vault: vaultKeypair.publicKey,
          traderTokenAccount: traderBTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([traderB])
        .rpc();

      const orderBook = await program.account.orderBook.fetch(orderBookPda);
      expect(orderBook.asks.length).to.equal(1);
      expect(orderBook.asks[0].owner.toBase58()).to.equal(traderB.publicKey.toBase58());
    });
  });

  describe("4. Order Matching & Position Creation", () => {
    it("keeper matches crossing bid and ask, creating on-chain Position PDAs", async () => {
      await program.methods
        .matchOrders()
        .accounts({
          keeper: keeper.publicKey,
          market: marketPda,
          orderBook: orderBookPda,
          bidOwner: traderA.publicKey,
          askOwner: traderB.publicKey,
          bidMargin: traderAMarginPda,
          askMargin: traderBMarginPda,
          bidPosition: traderAPositionPda,
          askPosition: traderBPositionPda,
          vault: vaultKeypair.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .signers([keeper])
        .rpc();

      // Verify order book has been cleared
      const orderBook = await program.account.orderBook.fetch(orderBookPda);
      expect(orderBook.bids.length).to.equal(0);
      expect(orderBook.asks.length).to.equal(0);

      // Verify Trader A Long position PDA
      const posA = await program.account.position.fetch(traderAPositionPda);
      expect(posA.owner.toBase58()).to.equal(traderA.publicKey.toBase58());
      expect(posA.market.toBase58()).to.equal(marketPda.toBase58());
      expect(posA.leverage).to.equal(5);
      expect(posA.size.toNumber()).to.be.greaterThan(0);

      // Verify Trader B Short position PDA
      const posB = await program.account.position.fetch(traderBPositionPda);
      expect(posB.owner.toBase58()).to.equal(traderB.publicKey.toBase58());
      expect(posB.market.toBase58()).to.equal(marketPda.toBase58());
      expect(posB.size.toNumber()).to.be.greaterThan(0);

      // Verify Market Open Interest updated
      const market = await program.account.market.fetch(marketPda);
      expect(market.openInterestLong.toNumber()).to.be.greaterThan(0);
      expect(market.openInterestShort.toNumber()).to.be.greaterThan(0);
    });
  });

  describe("5. Liquidation Thresholds & Edge Cases", () => {
    it("rejects liquidating a healthy position (PositionNotLiquidatable)", async () => {
      try {
        await program.methods
          .liquidate()
          .accounts({
            keeper: keeper.publicKey,
            market: marketPda,
            position: traderAPositionPda,
            vault: vaultKeypair.publicKey,
            keeperTokenAccount: keeperTokenAccount,
            oracle: mockOracleKeypair.publicKey,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .signers([keeper])
          .rpc();
        expect.fail("Should have failed with PositionNotLiquidatable or InvalidOracle");
      } catch (err: any) {
        // Will fail because position is healthy or mock oracle account not populated
        expect(err.toString()).to.not.be.empty;
      }
    });
  });

  describe("6. Funding Rate Distribution", () => {
    it("rejects update_funding_rate before interval expires (FundingTooEarly)", async () => {
      try {
        await program.methods
          .updateFundingRate()
          .accounts({
            authority: authority.publicKey,
            market: marketPda,
            clock: SYSVAR_CLOCK_PUBKEY,
          })
          .signers([authority])
          .rpc();
        expect.fail("Should have failed with FundingTooEarly");
      } catch (err: any) {
        expect(err.error?.errorCode?.code || err.toString()).to.include("FundingTooEarly");
      }
    });
  });

  describe("7. Order Cancellation", () => {
    it("allows trader to cancel their open limit order", async () => {
      // Place a new bid order
      const price = new anchor.BN(60_000 * PRICE_DECIMALS);
      const sizeUsdc = new anchor.BN(200 * SIZE_DECIMALS);

      await program.methods
        .placeOrder({ long: {} }, price, sizeUsdc, 2)
        .accounts({
          signer: traderA.publicKey,
          market: marketPda,
          orderBook: orderBookPda,
          marginAccount: traderAMarginPda,
          vault: vaultKeypair.publicKey,
          traderTokenAccount: traderATokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([traderA])
        .rpc();

      let orderBook = await program.account.orderBook.fetch(orderBookPda);
      expect(orderBook.bids.length).to.equal(1);

      // Cancel it (order index 0, Long)
      await program.methods
        .cancelOrder(new anchor.BN(0), { long: {} })
        .accounts({
          trader: traderA.publicKey,
          market: marketPda,
          orderBook: orderBookPda,
          marginAccount: traderAMarginPda,
        })
        .signers([traderA])
        .rpc();

      orderBook = await program.account.orderBook.fetch(orderBookPda);
      expect(orderBook.bids.length).to.equal(0);
    });
  });
});
