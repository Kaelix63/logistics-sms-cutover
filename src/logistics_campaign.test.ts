import assert from "node:assert/strict";
import { messagesFor } from "./logistics_campaign.js";

const result = messagesFor({ shipments: [
  { shipmentId: "A", phone: "+155500001", event: "delivered", proofOfDelivery: "pod/A.jpg" },
  { shipmentId: "B", phone: "+155500002", event: "exception" },
] });

assert.deepEqual(result, [{
  to: "+155500001",
  message: "Shipment A delivered. Proof: pod/A.jpg.",
}]);
console.log("logistics decision test passed");
