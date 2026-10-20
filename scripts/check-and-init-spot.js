const web3 = require("../app/node_modules/@solana/web3.js");
const spl = require("../app/node_modules/@solana/spl-token");
const fs = require("fs");
const path = require("path");

const CLUSTER = process.env.CLUSTER || "https://api.devnet.solana.com";
const PROGRAM_ID = new web3.PublicKey("D643vETCKW14hgvpmUoWZTYi65R9tijNm1RGmZFfS6g1");
const BASE_MINT = new web3.PublicKey("So11111111111111111111111111111111111111112");
const QUOTE_MINT = new web3.PublicKey("3NnctwUGZ8iXfK2bFbSKQMSQVJWgxhLveiwg5H3M98NE");

const INIT_SPOT_DISCRIMINATOR = Buffer.from([234, 196, 128, 44, 94, 15, 48, 201]);
const INIT_SPOT_ORDERBOOK_DISCRIMINATOR = Buffer.from([41, 28, 163, 16, 206, 177, 103, 15]);

async function main() {
  const conn = new web3.Connection(CLUSTER, "confirmed");
  const keypairPath = path.join(__dirname, "..", ".tmp-deploy.json");
  const secretKey = JSON.parse(fs.readFileSync(keypairPath, "utf8"));
  const deployer = web3.Keypair.fromSecretKey(Uint8Array.from(secretKey));

  console.log("Deployer:", deployer.publicKey.toBase58());
  const balance = await conn.getBalance(deployer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  const [spotMarket] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("spot_market"), BASE_MINT.toBuffer(), QUOTE_MINT.toBuffer()],
    PROGRAM_ID
  );
  console.log("Spot Market PDA:", spotMarket.toBase58());

  const [orderBook] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("spot_orderbook"), spotMarket.toBuffer()],
    PROGRAM_ID
  );
  const [marketInfo, orderBookInfo] = await Promise.all([
    conn.getAccountInfo(spotMarket),
    conn.getAccountInfo(orderBook),
  ]);
  if (marketInfo && orderBookInfo) {
    console.log("Spot market and order book are already initialized.");
    return;
  }
  if (marketInfo || orderBookInfo) {
    throw new Error("Spot market state is partial; inspect the PDAs before retrying.");
  }

  console.log("Spot market NOT initialized. Initializing now...");

  console.log("OrderBook PDA:", orderBook.toBase58());


  const baseVault = web3.Keypair.generate();
  const quoteVault = web3.Keypair.generate();

  const data = Buffer.alloc(16);
  INIT_SPOT_DISCRIMINATOR.copy(data, 0);
  data.writeBigUInt64LE(BigInt(10), 8); // 10 bps fee

  const initMarketIx = new web3.TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
      { pubkey: spotMarket, isSigner: false, isWritable: true },
      { pubkey: BASE_MINT, isSigner: false, isWritable: false },
      { pubkey: QUOTE_MINT, isSigner: false, isWritable: false },
      { pubkey: baseVault.publicKey, isSigner: true, isWritable: true },
      { pubkey: quoteVault.publicKey, isSigner: true, isWritable: true },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: spl.TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: web3.SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  const initOrderBookIx = new web3.TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: deployer.publicKey, isSigner: true, isWritable: true },
      { pubkey: spotMarket, isSigner: false, isWritable: false },
      { pubkey: orderBook, isSigner: false, isWritable: true },
      { pubkey: web3.SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: INIT_SPOT_ORDERBOOK_DISCRIMINATOR,
  });

  const tx = new web3.Transaction().add(initMarketIx, initOrderBookIx);
  tx.feePayer = deployer.publicKey;
  const bh = await conn.getLatestBlockhash("confirmed");
  tx.recentBlockhash = bh.blockhash;

  tx.sign(deployer, baseVault, quoteVault);

  console.log("Sending initializeSpotMarket transaction...");
  const rawTx = tx.serialize();
  const sig = await conn.sendRawTransaction(rawTx, { skipPreflight: false });
  console.log("Tx signature:", sig);
  const conf = await conn.confirmTransaction({
    signature: sig,
    blockhash: bh.blockhash,
    lastValidBlockHeight: bh.lastValidBlockHeight,
  }, "confirmed");

  if (conf.value.err) {
    console.error("Tx failed:", conf.value.err);
  } else {
    console.log("Spot market initialized successfully!");
  }
}

main().catch(console.error);
