import { json } from '@sveltejs/kit';
import { getUnregisteredSenders } from '$lib/server/db';

export function GET({ url }: { url: URL }): Response {
  const agentGroupId = url.searchParams.get('groupId') ?? undefined;
  const channelType = url.searchParams.get('channelType') ?? undefined;
  const senders = getUnregisteredSenders({ agentGroupId, channelType });
  return json(senders);
}
