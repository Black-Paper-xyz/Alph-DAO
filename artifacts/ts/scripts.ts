/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */

import {
  Address,
  ExecutableScript,
  ExecuteScriptParams,
  ExecuteScriptResult,
  Script,
  SignerProvider,
  HexString,
} from "@alephium/web3";
import { getContractByCodeHash } from "./contracts";
import { default as CancelVoteScriptJson } from "../scripts/CancelVote.ral.json";
import { default as MintScriptJson } from "../scripts/Mint.ral.json";
import { default as ProposeUpgradeScriptJson } from "../scripts/ProposeUpgrade.ral.json";
import { default as VoteScriptJson } from "../scripts/Vote.ral.json";

export const CancelVote = new ExecutableScript<{ votingBox: HexString }>(
  Script.fromJson(CancelVoteScriptJson, "", []),
  getContractByCodeHash
);

export const Mint = new ExecutableScript<{ token: HexString; amount: bigint }>(
  Script.fromJson(MintScriptJson, "", []),
  getContractByCodeHash
);

export const ProposeUpgrade = new ExecutableScript<{
  dao: HexString;
  target: HexString;
}>(Script.fromJson(ProposeUpgradeScriptJson, "", []), getContractByCodeHash);

export const Vote = new ExecutableScript<{
  votingBox: HexString;
  vote: boolean;
  amount: bigint;
  daoToken: HexString;
}>(Script.fromJson(VoteScriptJson, "", []), getContractByCodeHash);
