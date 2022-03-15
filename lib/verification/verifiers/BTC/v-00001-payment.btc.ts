//////////////////////////////////////////////////////////////
// This file is auto generated. You may edit it only in the 
// marked section between //-$$$<start> and //-$$$<end>.
// You may also import custom imports needed for the code
// in the custom section, which should be placed immediately 
// in the usual import section (below this comment)
//////////////////////////////////////////////////////////////

import { ARPayment, Attestation, BN, DHPayment, hashPayment, IndexedQueryManager, MCC, parseRequestBytes, randSol, TDEF_payment, Verification, VerificationStatus, Web3 } from "./0imports";


const web3 = new Web3();

export async function verifyPaymentBTC(client: MCC.BTC, attestation: Attestation, indexer: IndexedQueryManager, recheck = false) {
   let request = parseRequestBytes(attestation.data.request, TDEF_payment) as ARPayment;
   let roundId = attestation.round.roundId;

   //-$$$<start> of the custom code section. Do not change this comment. XXX

   // Payment proof must have payment reference!!!
   // If transaction has payment reference we collect all vins and their vouts (we can calculate all from there)

// XXXX

   //-$$$<end> of the custom section. Do not change this comment.

   let response = {
      blockNumber: randSol(request, "blockNumber", "uint64") as BN,
      blockTimestamp: randSol(request, "blockTimestamp", "uint64") as BN,
      transactionHash: randSol(request, "transactionHash", "bytes32") as string,
      utxo: randSol(request, "utxo", "uint8") as BN,
      sourceAddress: randSol(request, "sourceAddress", "bytes32") as string,
      receivingAddress: randSol(request, "receivingAddress", "bytes32") as string,
      paymentReference: randSol(request, "paymentReference", "bytes32") as string,
      spentAmount: randSol(request, "spentAmount", "int256") as BN,
      receivedAmount: randSol(request, "receivedAmount", "uint256") as BN,
      oneToOne: randSol(request, "oneToOne", "bool") as boolean,
      status: randSol(request, "status", "uint8") as BN      
   } as DHPayment;

   let hash = hashPayment(request, response);

   return {
      hash,
      response,
      status: VerificationStatus.OK
   } as Verification<DHPayment>;
}   
