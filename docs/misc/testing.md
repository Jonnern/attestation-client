# Testing

We test attestation client on multiple levels split intu multiple sections.

All of the scripts associated with testing are collected in `-------TESTS---------` section in package.json.

- Some tests are run in hardhat environment to test smart contracts and their interaction with network (`.test-contract.ts`)
- Others are run with mocha. They are split into three groups: regular tests (`.test.ts`), slower tests (`.test-slow.ts`) and tests that need some additional credentials(`.test-cred.ts`).

## Tooling

- [mocha](https://github.com/mochajs/mocha)
- [hardhat](https://github.com/NomicFoundation/hardhat)
- [sinon](https://github.com/sinonjs/sinon)
- [chai](https://github.com/chaijs/chai)
- [chai-as-promised](https://github.com/domenic/chai-as-promised)

## Coverage

run

Run all fast tests

```bash
yarn test:coverage
```

Run all tests except the tests that need api credentials

```bash
yarn test:coverage-full
```

Run all tests including the tests that need api credentials that need to be provided

```bash
yarn test:coverage-fullc
```

## Setting up testing environment

[Back to home](../README.md)
