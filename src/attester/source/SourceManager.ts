import { Managed } from "@flarenetwork/mcc";
import { criticalAsync } from "../../indexer/indexer-utils";
import { getTimeMs, getTimeSec } from "../../utils/helpers/internetTime";
import { AttLogger, logException } from "../../utils/logging/logger";

import { AttestationDefinitionStore } from "../../external-libs/AttestationDefinitionStore";
import { AttestationResponse, AttestationResponseStatus } from "../../external-libs/AttestationResponse";
import { ARBase, ARESBase } from "../../external-libs/interfaces";
import { MIC_SALT } from "../../external-libs/utils";
import { VerifierSourceRouteConfig } from "../../verification/routing/configs/VerifierSourceRouteConfig";
import { Attestation } from "../Attestation";
import { GlobalConfigManager } from "../GlobalConfigManager";
import { AttestationStatus } from "../types/AttestationStatus";

@Managed()
export class SourceManager {
  globalConfigManager: GlobalConfigManager;
  // rate limiting control
  requestTime = 0;
  requestsPerSecond = 0;

  sourceId: string;

  // queues
  attestationsQueue = new Array<Attestation>();
  attestationProcessing = new Set<Attestation>();

  latestRoundId = 0;

  constructor(globalConfigManager: GlobalConfigManager, sourceId: string) {
    this.globalConfigManager = globalConfigManager;
    this.sourceId = sourceId;
  }

  /**
   * Returns verifier source config for the latest round id, that is initialized on the SourceManager.
   */
  get verifierSourceConfig(): VerifierSourceRouteConfig | undefined {
    const config = this.globalConfigManager.getVerifierRouter(this.latestRoundId).config;
    if (!config) return;
    return config.getSourceConfig(this.sourceId);
  }

  /**
   * Returns max number of requests per second.
   */
  get maxRequestsPerSecond(): number {
    const config = this.verifierSourceConfig;
    if (!config) return Infinity; // requests will be rejected anyway, since there is no routing
    return config.maxRequestsPerSecond;
  }

  /**
   * Maximal number of transactions that can be in processing simultaneously.
   */
  get maxProcessingTransactions(): number {
    const config = this.verifierSourceConfig;
    if (!config) return Infinity; // requests will be rejected anyway, since there is no routing
    return config.maxProcessingTransactions;
  }

  /**
   * Returns max number of failed retries before terminating the application process.
   */
  get maxFailedRetries(): number {
    const config = this.verifierSourceConfig;
    if (!config) return 3; // requests will be rejected anyway, since there is no routing
    return config.maxFailedRetries;
  }

  /**
   * Returns delay before retrying in ms.
   */
  get delayBeforeRetryMs(): number {
    const config = this.verifierSourceConfig;
    if (!config) return 100; // requests will be rejected anyway, since there is no routing
    return config.delayBeforeRetryMs;
  }
  /**
   * Refreshes verifier source configuration for given roundId.
   * @param sourceId
   * @param roundId
   */
  public refreshLatestRoundId(roundId: number) {
    if (this.latestRoundId > roundId) return;
    this.latestRoundId = roundId;
  }

  /**
   * Returns logger.
   */
  public get logger(): AttLogger {
    return this.globalConfigManager.logger;
  }

  /**
   * Returns attestation client label for logging.
   */
  public get label() {
    return this.globalConfigManager.label;
  }

  /**
   * Returns `true` if new attestation requests can be added for processing (subject to rate limit).
   * @returns
   */
  private canProcessRequestsInThisSecond() {
    const time = getTimeSec();
    // second shifted, new quota
    if (this.requestTime !== time) return true;
    // still the same quota, count requests
    return this.requestsPerSecond < this.maxRequestsPerSecond;
  }

  /**
   * Increases sent request count. Used for managing rate limits.
   */
  private increaseRequestCount() {
    const time = getTimeSec();

    if (this.requestTime === time) {
      this.requestsPerSecond++;
    } else {
      this.requestTime = time;
      this.requestsPerSecond = 0;
    }
  }

  /**
   * Returns true if an additional request can be processed. It checks whether rate limit is achieved for current second
   * and if maximal number of transactions that can be processed simultaneously is achieved.
   * @returns
   */
  private canProcessNextAttestation() {
    return this.canProcessRequestsInThisSecond() && this.attestationProcessing.size < this.maxProcessingTransactions;
  }

  /**
   * Adds the attestation into processing queue waiting for verification
   * @param attestation
   */
  private enQueue(attestation: Attestation) {
    //this.logger.info(`chain ${this.chainName} queue ${attestation.data.id} (${this.attestationQueue.length}++,${this.attestationProcessing.length},${this.transactionsDone.length})`);
    attestation.status = AttestationStatus.queued;
    this.attestationsQueue.push(attestation);
  }

  /**
   * Starts the validation process for the attestation.
   * This function should never fail due to exception in normal operations. If it does, it is a critical error stopping the application.
   * @param attestation
   * @returns
   */
  private async process(attestation: Attestation) {
    const verifierRouter = this.globalConfigManager.getVerifierRouter(attestation.roundId);
    if (!verifierRouter) {
      // this should not happen
      this.logger.error(`${this.label} Assert: verifier router for round should exist. Critical error`);
      process.exit(1);
      return; // Don't delete needed for testing
    }
    // Check again, if verifier supports the attestation type
    if (!verifierRouter.isSupported(attestation.data.sourceId, attestation.data.attestationType)) {
      this.logger.info(`No verifier routes for source '${attestation.data.sourceId}' for type '${attestation.data.attestationType}'`);
      this.onProcessed(attestation, AttestationStatus.failed);
      return;
    }

    const now = getTimeMs();

    // check if the transaction is too late
    if (now > attestation.round.commitEndTimeMs) {
      this.logger.info(`Attestation ${attestation.data.request} too late to process`);
      this.onProcessed(attestation, AttestationStatus.tooLate);
      return;
    }

    this.attestationProcessing.add(attestation);

    attestation.status = AttestationStatus.processing;
    attestation.processStartTime = now;

    this.increaseRequestCount();
    verifierRouter
      .verifyAttestation(attestation)
      .then((verification: AttestationResponse<ARESBase>) => {
        attestation.processEndTime = getTimeMs();
        let status = verification.status;
        if (status === AttestationResponseStatus.VALID) {
          // check message integrity
          const requestPrefix = AttestationDefinitionStore.extractPrefixFromRequest(attestation.data.request);
          const micOk =
            requestPrefix.messageIntegrityCode.toLowerCase() ===
            this.globalConfigManager.definitionStore.attestationResponseHash(verification.response, MIC_SALT).toLowerCase();
          if (micOk) {
            // augment the attestation response with the round id
            verification.response.votingRound = attestation.roundId.toString();
            // calculate the correct hash, with given roundId
            const hash = this.globalConfigManager.definitionStore.attestationResponseHash(verification.response);

            // verify that the request bodies match
            const actualRequest = this.globalConfigManager.definitionStore.parseRequest(attestation.data.request);

            const reconstructedRequest = {
              ...requestPrefix,
              requestBody: verification.response.requestBody,
            } as ARBase;
            try {
              const encodedReconstructedRequest = this.globalConfigManager.definitionStore.encodeRequest(reconstructedRequest);
              if (encodedReconstructedRequest.toLowerCase() !== attestation.data.request.toLowerCase()) {
                this.logger.error2(`${this.label} MISMATCH REQUEST BODY for ${attestation.data.request}`);
                this.onProcessed(attestation, AttestationStatus.invalid, verification);
                return;
              }
            } catch (error) {
              this.logger.error2(`${this.label} UNPARSABLE RECONSTRUCTED REQUEST for ${attestation.data.request}, reconstructed ${reconstructedRequest}`);
              this.onProcessed(attestation, AttestationStatus.invalid, verification);
              return;
            }

            // Everything is OK
            attestation.parsedRequest = actualRequest;
            this.onProcessed(attestation, AttestationStatus.valid, verification, hash);
            return;
          }
          this.logger.debug(`${this.label} WRONG MIC for ${attestation.data.request}`);
          this.onProcessed(attestation, AttestationStatus.invalid, verification);
          return;
        }

        if (verification.status === AttestationResponseStatus.INDETERMINATE) {
          this.logger.error2(`${this.label} INDETERMINATE VERIFICATION STATUS: ${attestation.data.request}`);
          this.onProcessed(attestation, AttestationStatus.error, verification);
          return;
        }

        if (verification.status !== AttestationResponseStatus.INVALID) {
          // assert - this should never happen
          this.logger.error2(`${this.label} Critical error: The summarized verification status should be 'invalid': ${attestation.data.request}`);
          process.exit(1);
        }
        // The verification is invalid as it returns error verification status
        this.onProcessed(attestation, AttestationStatus.invalid, verification);
      })
      .catch((error: any) => {
        // Exception happens on API errors, both the ones that return status ERROR and ones that fail.
        // In both cases the default direction is retry
        logException(error, `${this.label} verifyAttestation ${error}`);
        attestation.exception = error;

        // Retries
        attestation.processEndTime = getTimeMs();
        if (attestation.retry < this.maxFailedRetries) {
          this.logger.warning(`${this.label} transaction verification error (retry ${attestation.retry})`);
          attestation.retry++;
          // eslint-disable-next-line
          criticalAsync(`SourceManager::retry number ${attestation.retry + 1}`, () => this.process(attestation!));
        } else {
          // too many retries, just log and mark as failed
          this.logger.error2(`${this.label} transaction verification error ${attestation.data.request}`);
          this.onProcessed(attestation, AttestationStatus.error);
        }
      });
  }

  /**
   * A callback to be called when an attestation is processed.
   * Sets the Attestation status and adds verificationData to the attestation
   * @param attestation
   * @param status
   * @param verificationData
   */
  private onProcessed(attestation: Attestation, status: AttestationStatus, verificationData?: AttestationResponse<any>, hash?: string) {
    let actualStatus = status;
    if (actualStatus === AttestationStatus.valid && !verificationData) {
      this.logger.error("Attestation status is valid but no verification data provided. Attestation considered as invalid");
      actualStatus = AttestationStatus.failed;
    }

    // set status
    attestation.status = actualStatus;
    attestation.verificationData = verificationData;
    attestation.hash = hash;

    // move into processed
    this.attestationProcessing.delete(attestation);

    // signal a new attestation was processed
    attestation.round.onAttestationProcessed(attestation);

    if (attestation.status !== AttestationStatus.tooLate) {
      // start next transaction
      this.startNext();
    }
  }

  /**
   * Verifies the attestation request.
   * If possible the attestation is processed, otherwise it is added the queue.
   * @param attestation
   */
  public verifyAttestationRequest(attestation: Attestation): void {
    //this.logger.info(`chain ${this.chainName} validate ${transaction.data.getHash()}`);

    // check if transaction can be added into processing
    if (this.canProcessNextAttestation()) {
      // eslint-disable-next-line
      criticalAsync(`SourceManager::validate::process`, () => this.process(attestation));
    } else {
      this.enQueue(attestation);
    }
  }

  /**
   * Processes the next attestation in the queue
   */
  private startNext(): void {
    try {
      if (!this.canProcessNextAttestation()) {
        if (this.attestationProcessing.size === 0) {
          this.logger.debug(`${this.label} # startNext heartbeat`);
          setTimeout(() => {
            this.startNext();
          }, 100); // retry in 100 ms
        }
        return;
      }

      // check if there is any queued transaction to be processed
      while (this.attestationsQueue.length && this.canProcessNextAttestation()) {
        const attestation = this.attestationsQueue.shift();

        // eslint-disable-next-line
        criticalAsync(`SourceManager::startNext::process-2`, () => this.process(attestation!));
      }
    } catch (error) {
      logException(error, `${this.label} SourceManager::startNext`);
    }
  }
}
