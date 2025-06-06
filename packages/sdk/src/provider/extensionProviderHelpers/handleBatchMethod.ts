import { analytics } from '@metamask/sdk-analytics';
import { MetaMaskInpageProvider } from '@metamask/providers';
import {
  TrackingEvents,
  IGNORE_ANALYTICS_RPCS,
} from '@metamask/sdk-communication-layer';
import { MetaMaskSDK } from '../../sdk';
import { RequestArguments } from '../wrapExtensionProvider';
import { getPlatformDetails } from './handleUuid';

export const handleBatchMethod = async ({
  target,
  args,
  trackEvent,
  sdkInstance,
}: {
  target: MetaMaskInpageProvider;
  args: RequestArguments;
  trackEvent: boolean;
  sdkInstance: MetaMaskSDK;
}) => {
  if (args.method !== 'metamask_batch') {
    throw new Error('Invalid usage');
  }

  // params is a list of RPCs to call
  const responses = [];
  const params = args?.params ?? [];
  for (const rpc of params) {
    const response = await target?.request({
      method: rpc.method,
      params: rpc.params,
    });
    responses.push(response);
  }

  const { id, from } = getPlatformDetails(sdkInstance);

  if (trackEvent) {
    sdkInstance.analytics?.send({
      event: TrackingEvents.SDK_RPC_REQUEST_DONE,
      params: {
        method: args.method,
        from,
        id,
      },
    });
  }

  if (!IGNORE_ANALYTICS_RPCS.includes(args.method)) {
    for (const response of responses) {
      if (response && typeof response === 'object' && 'error' in response) {
        const errorObj: any = (response as any).error;
        // Detect user-rejected errors (EIP-1193 error code 4001)
        if (errorObj && errorObj.code === 4001) {
          analytics.track('sdk_action_rejected', { action: args.method });
        } else {
          analytics.track('sdk_action_failed', { action: args.method });
        }
      } else {
        analytics.track('sdk_action_succeeded', { action: args.method });
      }
    }
  }

  return responses;
};
