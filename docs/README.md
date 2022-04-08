# Documentation for attestation protocol

- [Attestation Protocol](./attestation-protocol/attestation-protocol.md)
  - [State connector contract](./attestation-protocol/state-connector-contract.md)
  - [Limiting attestation requests](./attestation-protocol/attestation-limiter.md)
- [Indexer](./indexing/indexer.md)
  - [Scope of indexing](./indexing/indexer-scope.md)
  - [Sinchronized query window](./indexing/synchronized-query-window.md)
  - [Optimizations](./indexing/indexer-optimizations.md)
- [Merkle tree and proofs](./merkle-tree.md)
- [Attestation types](./attestation-types.md)
  - [Adding new attestation types](./attestation-types/adding-new-attestation-types.md)
  - [00001 - Payment](attestation-types/00001-payment.md)
  - [00002 - Balance Decreasing Transaction](attestation-types/00002-balance-decreasing-transaction.md)
  - [00003 - Confirmed Block Height](attestation-types/00003-confirmed-block-height-exists.md)
  - [00004 - Referenced Payment Nonexistence](attestation-types/00004-referenced-payment-nonexistence.md)
- [Attestation client](./attestation-client/attestation-client.md)
  - [Configurations](./attestation-client/attestation-configs.md)
  - [Verification](./attestation-client/verification.md)
  - [Code generation utils](./attestation-client/code-generation-utils.ts)

## Definitions

- [Account based vs. UTXO model](./definitions/account-based-vs-utxo-chains.md)
- [Native payment](./definitions/native-payment.md)
- [Payment reference](./definitions/payment-reference.md)
- [Data sources](./definitions/sources.md)
- [Transaction status](./definitions/transaction-status.md)