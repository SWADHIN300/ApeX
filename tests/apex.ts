import * as anchor from "@coral-xyz/anchor";

describe("apex", () => {
  anchor.setProvider(anchor.AnchorProvider.env());

  it("initializes", async () => {
    const program = anchor.workspace.Apex;
    await program.methods.initialize().rpc();
  });
});
