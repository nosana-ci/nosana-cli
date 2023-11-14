# Nosana Typescript CLI

A CLI package for running [Nosana](https://nosana.io/) jobs.

## What is the Nosana Typescript CLI?

The Nosana Typescript CLI contains everything you need to run CI/CD jobs on the Nosana Network.

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
Available commands:
```
run [options] [command...]  Create a job to run by Nosana Runners
get [options] <job>         Get a job and display result
download <ipfs> [path]      Download an external artifact from IPFS to specified path
help [command]              display help for command
```

Global options:
```
-V, --version               output the version number
-n, --network <network>     network to run on (default: "devnet")
-m, --market <market>       market to post job to
-w, --wallet <wallet>       path to wallet private key (default: "~/nosana_key.json")
-h, --help                  display help for command
```

## Running jobs
With the `nosana run [options] [command...]` command you can run nosana jobs. The default job type is `container`, meaning you can run commands in docker containers. 

### Example
The following command will run `echo hello world` with the default `ubuntu` docker image (can be changed with the `--image` flag), while we specify the `--wait` flag to wait for the results:
```shell
$ nosana run echo hello world --wait
```

All available options for `run`:
```
--airdrop                request an airdrop when low on SOL on devnet (default: true)
--gpu                    enable GPU on node
-o, --output <path>      specify which folder inside the container you want to upload
--wasm <url>             wasm url to run
--type <type>            type to run (default: "container")
-i, --image <image>      docker image to use (default: "ubuntu")
--f, --file [path]       file with the JSON flow
--raw                    display raw json job and result
--wait                   wait for job to be completed and show result
--download               download external artifacts (implies --wait)
```
## Documentation
Please [visit our documentation](https://docs.nosana.io/) for a full list of commands and examples.