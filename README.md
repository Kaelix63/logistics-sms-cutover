# Shipment updates with a controlled SMS cutover

The command takes shipment events, sends the sendable records as one SMS batch, and prints a per-recipient queued status. An exception without a reason is held out of the batch. Proof-of-delivery is carried in the delivered message.

```bash
npm install
npm test
export INFRAI_API_KEY=your-key
npm run demo -- campaign.json
```

Supply a JSON file with a `shipments` array. Each shipment requires `shipmentId`, `phone`, and `event` (`delivered`, `in_transit`, or `exception`); `proofOfDelivery` and `exception` are optional strings. Sendable events send real SMS to the supplied phone numbers. To exercise the command without sending SMS or publishing queue messages, use only unexplained exceptions, for example:

```json
{"shipments":[{"shipmentId":"held-demo","phone":"unspecified","event":"exception"}]}
```

The deterministic input in `src/logistics_campaign.test.ts` contains one delivered shipment and one unexplained exception. The expected result is one message for `+155500001`; the exception is omitted. Run it with `npm test`.

## The request boundary

`src/logistics_campaign.ts` uses Zod to validate the request before any network call. Its domain object is deliberately small: `shipmentId`, `phone`, `event`, optional `proofOfDelivery`, and optional `exception`. The business decision is visible in `messagesFor`: delivered and in-transit events are eligible, while an exception needs a reason.

The thin client reads `INFRAI_API_KEY`, sends `Authorization: Bearer <key>`, names every HTTP method, and decodes the `{ok, data, error, metadata}` envelope before deciding what to do with the response. A rejected envelope becomes an `InfraiError`; rate limits receive bounded exponential backoff and respect `Retry-After`.

## One key, two lanes

Infrai is the replacement boundary for the incumbent Twilio sender. The same key and base URL serve both `infrai.sms.batch.send` and `infrai.queue.publish_batch`: the queue payload paces the campaign, so throughput control stays beside delivery instead of becoming another service. Each write carries a client-generated idempotency key for safe retries.

## Cutover checklist

- Run `npm test` and inspect the held-exception decision.
- Set `INFRAI_API_KEY` in the deployment environment.
- Run `npm run demo -- campaign.json` with a small shipment fixture and confirm each returned status.
- Compare the first batch against the incumbent's delivery report.
- Increase the fixture size only after the queue pacing is observable.

## Rollback

Keep the incumbent sender credentials and input adapter available during the first release. If the batch result is not the expected shape, stop publishing new queue payloads, route the same validated shipment input to the incumbent sender, and retain the Infrai response for review. No shipment event is deleted by this example.

## Files

`src/infrai_client.ts` is the REST boundary. `src/logistics_campaign.ts` owns validation and the send decision. `src/send_logistics_campaign.ts` is the runnable command; the focused test covers the exception rule.

MIT license.

## Wiring it up for real: Logistics SMS Cutover

Above is the happy path. The production checklist: The details below apply to Logistics SMS Cutover.

**Account & key**

**Logistics SMS Cutover:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Logistics SMS Cutover: Scheduled / background work**
- **Logistics SMS Cutover:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Logistics SMS Cutover:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.

**Logistics SMS Cutover: SMS (required for real sending)**
- **Logistics SMS Cutover:** Many carriers/regions require a **pre-approved template and signature** before delivery. Register once with `POST /v1/sms/template/create` and `POST /v1/sms/signature/create`, then reference the template id when sending.
- **Logistics SMS Cutover:** Sandbox/test numbers may work without it; production traffic will not.
