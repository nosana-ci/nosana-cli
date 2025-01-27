# Nosana CLI

The Nosana CLI is a command-line tool for interacting with the [Nosana Network](https://nosana.com), enabling users to post jobs to the network or run a Nosana Node seamlessly.

---
## Features

- **Post Jobs**: Easily post jobs to the Nosana Network.
- **Run a Node**: Set up and manage a Nosana Node.

## Install

```shell
$ npm install -g @nosana/cli

# or install with yarn
$ yarn global add @nosana/cli
```

**HINT**\
Alternatively, you can use `npx` to use the cli directly without installing it globally:

```shell
$ npx @nosana/cli help
```

## Basic Usage

Once installed, you can invoke CLI commands directly from your OS command line through the `nosana` executable. See the available commands by entering the following:

```shell
$ nosana help
```

All interactions with Nosana CLI are of the form

```shell
$ nosana [command] [options] [argument]
```

Available `node` commands:

```
node view <node>                          View (any) Nosana Node
node join [command]                       Register for Nosana Grid
node start [options] <market>             Start Nosana Node
node run [options] <job-definition-file>  Run Job Definition File
node help [command]                       display help for command
```

Available `job` commands:

```
job post [options] [command...] Create a job to run by Nosana Runners
job get [options] <job>         Get a job and display result
job download <ipfs> [path]      Download an external artifact from IPFS to specified path
job help [command]              display help for command
```

Global options:

```
-V, --version                        output the version number
-n, --network <network>              network to run on (choices: "devnet", "mainnet", default: "mainnet")
--rpc <url>                          RPC node to use
--log <logLevel>                     Log level (choices: "info", "none", "debug", "trace", default: "debug")
```

## Start a Nosana Node

To get started with your Nosana Node on the Nosana Grid, you can run a node after you've installed the prerequisites with the following command:

`nosana node start [options]`

Options:

```
  --provider <provider>     provider used to run the job (choices: "docker", "podman", default: "podman")
  -w, --wallet <wallet>     path to wallet private key (default: "~/.nosana/nosana_key.json")
  --docker, --podman <URI>  Podman/Docker connection URI (default: "http://localhost:8080")
  -h, --help                display help for command
```

## Starting node

With the `nosana node start [options]` command you can start a Nosana Node and join the Nosana Network.

Options:

```
  --provider <provider>     provider used to run the job (choices: "docker", "podman", default: "podman")
  -w, --wallet <wallet>     path to wallet private key (default: "~/.nosana/nosana_key.json")
  --docker, --podman <URI>  Podman/Docker connection URI (default: "http://localhost:8080")
  -h, --help                display help for command
```

## Posting jobs

With the `nosana job post [options] [command...]` command you can post nosana jobs to the Nosana Network. The default job type is `container`, meaning nodes will run your job in docker containers.

### Example

The following command will run `echo hello world` with the default `ubuntu` docker image (can be changed with the `--image` flag), while we specify the `--wait` flag to wait for the results:

```shell
$ nosana job post echo hello world --wait
```

All available options for `post`:

```
--airdrop                request an airdrop when low on SOL on devnet (default: true)
--gpu                    enable GPU on node
-o, --output <path>      specify which folder inside the container you want to upload
--type <type>            type to run (default: "container")
-i, --image <image>      docker image to use (default: "ubuntu")
--f, --file <path>       file with the JSON flow
--wait                   wait for job to be completed and show result
--download               download external artifacts (implies --wait)
```

## Documentation

Please [visit our documentation](https://docs.nosana.com/) for a full list of commands and examples.

For technical details on how the Nosana CLI works, refer to the technical documentation:

[Technical Documentation](https://github.com/nosana-ci/nosana-cli/tree/main/docs)