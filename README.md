# Nosana Typescript SDK

A client package for running [Nosana](https://nosana.io/) jobs.

## What is the Nosana Typescript SDK?

The Nosana Typescript SDK contains everything you need to run CI/CD jobs on the Nosana Network.

## Install

```shell
npm install --save @nosana/sdk

# or install with yarn
yarn add @nosana/sdk
```
## Example usage

```ts
import { Client } from "@nosana/sdk";

const nosana = new Client({
  solana: {
    network: 'devnet',
  },
});

// ipfs service
nosana.ipfs...
// secrets service
nosana.secrets...
// solana service
nosana.solana...
```

## Documentation

Please [visit our documentation](https://docs.nosana.io/) for a full list of commands and examples.