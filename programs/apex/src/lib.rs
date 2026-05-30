use anchor_lang::prelude::*;

declare_id!("4X73X5YSS6zk6FBbjHKp9L4DGMMJfqKbvjkD6Q8Vf22e");

#[program]
pub mod apex {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
