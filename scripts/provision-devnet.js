#!/usr/bin/env node
/**
 * provisions/provision-devnet.js
 *
 * One-shot devnet provisioning for ApeX:
 *   1. creates (or reuses) a 6-decimal collateral mint and mints supply to the deployer
 *   2. pre-creates a mock-oracle feed account (owned by the mock_oracle program)
 *      and fills it with Pyth-layout data via mock_oracle:initialize
 *   3. initializes the ApeX market for that collateral + oracle
 *
 * Idempotent: pooling existing addresses in dist/provisioned.json lets a retry
 * skip already-completed steps (handy on a flaky devnet RPC).
 *
 * Usage:
 *   node scripts/provision-devnet.js <deployer-keypair.json> [price_usd]
 *
 * Requires @solana/web3.js + @solana/spl-token (installed under app/).
 */
const web3 = require("../app/node_modules/@solana/web3.js");
const spl = require("../app/node_modules/@solana/spl-token");
const fs = require("fs");
const path = require("path");

const CLUSTER = process.env.CLUSTER || "https://api.devnet.solana.com";
const PROGRAM_ID = "D643vETCKW14hgvpmUoWZTYi65R9tijNm1RGmZFfS6g1";
const MOCK_PROGRAM_DEFAULT = "J53dL28RAq81mR2xzDnEx55U8mTRJcbW95P49yaB1jAR";
const FEE_RATE_BPS = 4;
const INIT_MARKET_DISCRIMINATOR = Buffer.from([35, 35, 189, 193, 155, 48, 170, 203]);
const OUT_FILE = path.join(__dirname, "..", "provisioned.json");

function decode(secret) { return web3.Keypair.fromSecretKey(Uint8Array.from(secret)); }
function live() { return JSON.parse(fs.readFileSync(OUT_FILE, "utf8")); }
function save(o) { fs.writeFileSync(OUT_FILE, JSON.stringify(o, null, 2)); }

async function confirm_tx(conn, sig) {
  const r = await conn.confirmTransaction(sig, "confirmed");
  if (r?.value?.err) throw new Error("tx failed: " + JSON.stringify(r.value.err));
  console.log("  ✓", sig.slice(0, 16) + "…");
}

async function send(conn, payer, ix, signers) {
  const bh = await conn.getRecentBlockhash("confirmed");
  const tx = new web3.Transaction({ feePayer: payer.publicKey, recentBlockhash: bh.blockhash }).add(ix);
  const sig = await web3.sendAndConfirmTransaction(conn, tx, signers, { commitment: "confirmed", skipPreflight: true });
  await confirm_tx(conn, sig);
}

(async () => {
  const keyFile = process.argv[2];
  const priceUsd = Number(process.argv[3] || 60000);
  if (!keyFile) { console.error("usage: node provision-devnet.js <deployer-keypair.json> [price_usd]"); process.exit(1); }
  const deploy = decode(JSON.parse(fs.readFileSync(keyFile, "utf8")));
  const conn = new web3.Connection(CLUSTER, "confirmed");
  const APEX = new web3.PublicKey(PROGRAM_ID);
  const prior = fs.existsSync(OUT_FILE) ? live() : {};
  const MOCK = new web3.PublicKey(prior.mockOracleProgram || MOCK_PROGRAM_DEFAULT);
  const out = prior;

  // --- collateral mint ---
  if (!out.baseMint) {
    const mint = await spl.createMint(conn, deploy, deploy.publicKey, null, 6);
    out.baseMint = mint.toBase58();
    const ata = await spl.getOrCreateAssociatedTokenAccount(conn, deploy, mint, deploy.publicKey);
    await spl.mintTo(conn, deploy, mint, ata.address, deploy, BigInt(2_000_000 * 1e6));
    out.deployerTokenAccount = ata.address.toBase58();
    console.log("mint", out.baseMint, "-> ATA", out.deployerTokenAccount);
    save(out);
  }
  const mint = new web3.PublicKey(out.baseMint);

  // --- mock oracle feed ---
  if (!out.oracle) {
    const feed = web3.Keypair.generate();
    const rent = await conn.getMinimumBalanceForRentExemption(240);
    await send(conn, deploy, web3.SystemProgram.createAccount({
      fromPubkey: deploy.publicKey, newAccountPubkey: feed.publicKey,
      lamports: rent, space: 240, programId: MOCK,
    }), [deploy, feed]);
    const d = Buffer.alloc(13);
    d[0] = 0; // initialize
    d.writeBigUInt64LE(BigInt(Math.round(priceUsd * 1e6)), 1);
    d.writeInt32LE(-6, 9);
    await send(conn, deploy, new web3.TransactionInstruction({ programId: MOCK, keys: [
      { pubkey: feed.publicKey, isSigner: false, isWritable: true },
    ], data: d }), [deploy]);
    out.oracle = feed.publicKey.toBase58();
    out.mockOracleProgram = MOCK.toBase58();
    console.log("oracle feed", out.oracle);
    save(out);
  }

  // --- apex market ---
  if (!out.market) {
    const [mkt] = web3.PublicKey.findProgramAddressSync([Buffer.from("market"), mint.toBuffer()], APEX);
    const [ob] = web3.PublicKey.findProgramAddressSync([Buffer.from("orderbook"), mkt.toBuffer()], APEX);
    const vault = web3.Keypair.generate();
    const iData = Buffer.alloc(16 + 32);
    INIT_MARKET_DISCRIMINATOR.copy(iData, 0);
    iData.writeBigUInt64LE(BigInt(FEE_RATE_BPS), 8);
    new web3.PublicKey(out.oracle).toBuffer().copy(iData, 16);
    await send(conn, deploy, new web3.TransactionInstruction({ programId: APEX, keys: [
      { pubkey: deploy.publicKey, isSigner: true, isWritable: true },
      { pubkey: mkt, isSigner: false, isWritable: true },
      { pubkey: vault.publicKey, isSigner: true, isWritable: true },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: ob, isSigner: false, isWritable: true },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: spl.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ], data: iData }), [deploy, vault]);
    out.programId = APEX.toBase58();
    out.market = mkt.toBase58();
    out.orderBook = ob.toBase58();
    out.vault = vault.publicKey.toBase58();
    out.priceUsd = priceUsd;
    console.log("market", out.market);
    save(out);
  }

  console.log("\n=== PROVISIONED ===");
  console.log(JSON.stringify(live(), null, 2));
})().catch((e) => { console.error("FATAL", e?.message || e); process.exit(1); });