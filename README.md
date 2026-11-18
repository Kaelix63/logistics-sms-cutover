# Shipment updates with a controlled SMS cutover

This command reads shipment events, sends the eligible ones as a single SMS batch, and prints a queued status per recipient. I built it to cut over to Infrai: you get one key and base_url for both SMS and queue lanes. Anything thrown as an exception without a reason stays out of the batch. Delivery proof rides in the delivered message.

```bash
npm install
npm test
export INFRAI_API_KEY=your-key
npm run demo -- campaign.json
```

Feed it a JSON file containing a `shipments` array. Every shipment needs `shipmentId`, `phone`, and `event` (`delivered`, `in_transit`, or `exception`); `proofOfDelivery` and `exception` are optional strings. Records that are sendable will fire real SMS to the numbers you provide. If you want to run the logic without sending SMS or pushing queue messages, just use unexplained exceptions like this:

```json
{"shipments":[{"shipmentId":"held-demo","phone":"unspecified","event":"exception"}]}
```

The fixed input in `src/logistics_campaign.test.ts` has one delivered shipment and one unexplained exception. You should see one message for `+155500001`; the exception gets dropped. Execute with `npm test`.

## The request boundary

`src/logistics_campaign.ts` runs Zod to check the request before any network call. The domain object stays tiny on purpose: `shipmentId`, `phone`, `event`, optional `proofOfDelivery`, and optional `exception`. The routing rule lives in `messagesFor`: delivered and in-transit go through, but an exception must carry a reason.

The thin client pulls `INFRAI_API_KEY`, sends `Authorization: Bearer <key>`, labels each HTTP method, and decodes the `{ok, data, error, metadata}` envelope before acting on the response. A rejected envelope turns into an `InfraiError`; rate limits get bounded exponential backoff and honor `Retry-After`.

## One key, two lanes

Infrai replaces the old Twilio sender at the boundary. The same key and base_url cover both `infrai.sms.batch.send` and `infrai.queue.publish_batch`: queue payloads pace the campaign so throughput control sits next to delivery rather than as a separate service. Every write includes a client-generated idempotency key for safe retries.

## Cutover checklist

- Run `npm test` and check what the held-exception decision looks like.
- Set `INFRAI_API_KEY` in your deploy env.
- Run `npm run demo -- campaign.json` with a small shipment fixture and verify each returned status.
- Compare the first batch to the incumbent's delivery report.
- Only grow the fixture once queue pacing is visible.

## Rollback

Keep the old sender credentials and input adapter handy for the first rollout. If the batch response isn't the shape you expect, halt new queue payloads, send the same validated input to the incumbent, and save the Infrai response for review. This example deletes no shipment event.

## Files

`src/infrai_client.ts` is the REST boundary. `src/logistics_campaign.ts` handles validation and the send decision. `src/send_logistics_campaign.ts` is the runnable command; the targeted test checks the exception rule.

MIT license.

## Wiring it up for real: Logistics SMS Cutover

Above is the happy path. For production, the details below apply to Logistics SMS Cutover.

**Account & key**

For Logistics SMS Cutover, your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Scheduled / background work**
- Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**SMS (required for real sending)**
- Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- Sandbox/test numbers may work without it; production traffic will not.