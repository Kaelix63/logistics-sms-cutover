import { z } from "zod";
import { infrai } from "./infrai_client.js";

export const shipmentEvent = z.object({
  shipmentId: z.string().min(1),
  phone: z.string().min(7),
  event: z.enum(["in_transit", "delivered", "exception"]),
  proofOfDelivery: z.string().optional(),
  exception: z.string().optional(),
});

export const campaignRequest = z.object({ shipments: z.array(shipmentEvent).min(1) });
export type CampaignRequest = z.infer<typeof campaignRequest>;

export function messagesFor(request: CampaignRequest) {
  return request.shipments
    .filter((shipment) => shipment.event !== "exception" || shipment.exception)
    .map((shipment) => ({
      to: shipment.phone,
      message: shipment.event === "delivered"
        ? `Shipment ${shipment.shipmentId} delivered. Proof: ${shipment.proofOfDelivery ?? "recorded"}.`
        : `Shipment ${shipment.shipmentId} is in transit.`,
    }));
}

export async function sendCampaign(input: unknown) {
  const request = campaignRequest.parse(input);
  const messages = messagesFor(request);
  if (messages.length === 0) return { decision: "held", reason: "no sendable shipment events", statuses: [] };
  const batch = await infrai.sms.batch.send({ messages }, `shipment-${request.shipments.map((s) => s.shipmentId).join("-")}`);
  await infrai.queue.publish_batch({ queue: "shipment-updates", messages }, `shipment-${request.shipments.length}`);
  return { decision: "sent", batch, statuses: messages.map(({ to }) => ({ to, status: "queued" })) };
}
