import {
  AdditionalTransactionDetails,
  AdditionalTxRequest,
  getTransactionOptions,
  RPCInterface,
  TransactionSuccessStatus,
  XrpGetTransactionResponse,
} from "../types";
import { prefix0x, toBN, xrp_ensure_data } from "../utils";
import axios from "axios";
import { LedgerRequest, LedgerResponse, Payment, TransactionMetadata, TxResponse } from "xrpl";

export class XRPImplementation implements RPCInterface {
  rippleApi: any;
  client: any;
  inRegTest: any;

  constructor(url: string, _username: string, _password: string, _inRegTest: boolean = false) {
    this.client = axios.create({
      baseURL: url,
      timeout: 15000,
      headers: { "Content-Type": "application/json" },
      validateStatus: function (status: number) {
        return (status >= 200 && status < 300) || status == 500;
      },
    });
    this.inRegTest = _inRegTest;
  }

  async getTransaction(txId: string, options?: getTransactionOptions): Promise<TxResponse> {
    const binary = options?.binary || false;
    const min_block = options?.min_block || undefined;
    const max_block = options?.max_block || undefined;
    interface XrpTxParams {
      transaction: string;
      binary: boolean;
      min_ledger?: number;
      max_ledger?: number;
    }
    let params: XrpTxParams = {
      transaction: txId,
      binary: binary,
    };
    if (min_block !== null && min_block !== null) {
      params.min_ledger = min_block;
      params.max_ledger = max_block;
    }
    let res = await this.client.post("", {
      method: "tx",
      params: [params],
    });
    xrp_ensure_data(res.data);
    return res.data;
  }

  async isHealthy() {
    let res = await this.client.post("", {
      method: "server_info",
      params: [{}],
    });
    console.log(res.data);
    const validStates = ["full"];
    xrp_ensure_data(res.data);
    let state = res.data.result.info.server_state;
    return validStates.includes(state);
  }

  async getBlockHeight() {
    let res = await this.client.post("", {
      method: "ledger_current",
      params: [{}],
    });
    xrp_ensure_data(res.data);
    return res.data.result.ledger_current_index;
  }

  async getBlock(blockNumberOrHash: number | string) {
    let res = await this.client.post("", {
      method: "ledger",
      params: [
        {
          ledger_index: blockNumberOrHash,
          transactions: true,
          expand: true,
          binary: false,
        } as LedgerRequest,
      ],
    });
    xrp_ensure_data(res.data);
    return res.data as LedgerResponse;
  }

  async createAddress(_createAddressData: any) {
    return;
  }

  async createRawTransaction(_walletLabel: string) {
    return;
  }

  async signRawTransaction(_walletLabel: string, _rawTx: string, _keysList: string[]) {
    return;
  }

  async sendRawTransaction(_walletLabel: string, _signedRawTx: string) {
    return;
  }

  async sendRawTransactionInBlock(_walletLabel: string, _signedRawTx: string) {
    return;
  }

  async fundAddress(_address: string, _amount: number) {
    return;
  }

  async getAdditionalTransactionDetails(request: AdditionalTxRequest): Promise<AdditionalTransactionDetails> {
    let blockNumber = request.transaction.result.ledger_index || 0;
    const blockResponse = (await this.getBlock(blockNumber)) as LedgerResponse;
    let metaData: TransactionMetadata = request.transaction.result.meta || (request.transaction.result as any).metaData;
    let transaction = request.transaction as TxResponse;
    let fee = toBN(request.transaction.result.Fee!);

    let confirmationBlockIndex = blockNumber + request.confirmations;
    let confirmationBlock = await this.getBlock(confirmationBlockIndex);
    
    let status = this.getTransactionStatus(request.transaction);

    let isNonPayment = !metaData 
                  || typeof metaData === "string"
                  || (request.transaction as TxResponse).result.TransactionType != "Payment" 
                  || (typeof metaData.delivered_amount != "string")
                  || metaData.TransactionResult != "tesSUCCESS"   // TODO - handle this properly

    if (isNonPayment) {
      return {
        transaction: request.transaction,
        blockNumber: toBN(blockNumber),
        blockHash: blockResponse.result.ledger_hash,
        txId: prefix0x(request.transaction.result.hash),
        sourceAddresses: transaction.result.Account,
        destinationAddresses: "",
        destinationTag: toBN(0),
        spent: toBN(0), // should be string or number
        delivered: toBN(0),
        fee,
        dataAvailabilityProof: prefix0x(confirmationBlock.result.ledger_hash),
        status,
      } as AdditionalTransactionDetails;
    }

    // Transaction is Payment
    let delivered = toBN(metaData.delivered_amount as string); // XRP in drops

    return {
      transaction: request.transaction,
      blockNumber: toBN(blockNumber),
      blockHash: blockResponse.result.ledger_hash,
      txId: prefix0x(request.transaction.result.hash),
      sourceAddresses: request.transaction.result.Account,
      destinationAddresses: (request.transaction.result as Payment).Destination,
      destinationTag: toBN((request.transaction.result as Payment).DestinationTag || 0),
      spent: toBN((request.transaction.result as Payment).Amount as any).add(fee), // should be string or number
      delivered: delivered,
      fee,
      dataAvailabilityProof: prefix0x(confirmationBlock.result.ledger_hash),
      status,
    } as AdditionalTransactionDetails;
  }
  getTransactionHashesFromBlock(block: LedgerResponse): string[] {
    return (block.result.ledger.transactions! as any).map((tx: any) => prefix0x((tx as any).hash));
  }

  getBlockHash(block: LedgerResponse): string {
    return prefix0x(block.result.ledger_hash);
  }

  getTransactionStatus(tx: TxResponse) {
    // TODO: Check transaction status!!!
    return TransactionSuccessStatus.SUCCESS;
  }

}