const express = require("express");

const {
  getServiceBinding,
  serviceToken,
  decodeJwt,
} = require("@sap-cloud-sdk/connectivity");

const app = express();

/**
 * Fetch all consumers subscribed to our SaaS application.
 *
 * SaaS Registry tells us:
 * - consumerTenantId -> tenant ID
 * - subdomain        -> tenant subdomain
 */
async function getSubscriptions() {
  const registry = getServiceBinding("saas-registry");
  const token = await serviceToken("saas-registry");

  const baseUrl =
    registry.credentials.saas_registry_url ||
    registry.credentials.url;

  const response = await fetch(
    `${baseUrl}/saas-manager/v1/application/subscriptions`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch subscriptions: ${response.status}`
    );
  }

  const data = await response.json();

  return data.subscriptions;
}

/**
 * Get a Destination Service JWT for a specific subscriber.
 *
 * We use:
 * - Destination Service client credentials
 * - subscriber subdomain
 *
 * The token is therefore issued in that subscriber's tenant context.
 */
async function getDestinationToken(subscription) {
  const destination = getServiceBinding("destination");

  const {
    clientid,
    clientsecret,
    url,
  } = destination.credentials;

  // Extract authentication domain from the provider URL.
  // Example:
  // provider.authentication.us10.hana.ondemand.com
  // ->
  // authentication.us10.hana.ondemand.com
  const authDomain = new URL(url)
    .hostname
    .split(".")
    .slice(1)
    .join(".");

  // Request the token from the subscriber's XSUAA tenant.
  const tokenUrl =
    `https://${subscription.subdomain}.${authDomain}/oauth/token`;

  const basicAuth = Buffer.from(
    `${clientid}:${clientsecret}`
  ).toString("base64");

  const response = await fetch(tokenUrl, {
    method: "POST",

    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },

    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Failed to get Destination token for ${subscription.subdomain}`
    );
  }

  const { access_token } = await response.json();

  // Optional verification:
  // zid should match subscription.consumerTenantId
  const decoded = decodeJwt(access_token);

  console.log(
    `${subscription.subdomain}:`,
    decoded.zid
  );

  return access_token;
}

/**
 * Fetch all subaccount-level destinations for one subscriber.
 */
async function getDestinations(subscription) {
  const destination = getServiceBinding("destination");

  // Get a Destination Service token in THIS subscriber's context.
  const token = await getDestinationToken(subscription);

  const baseUrl =
    destination.credentials.uri ||
    destination.credentials.url;

  const response = await fetch(
    `${baseUrl}/destination-configuration/v1/subaccountDestinations`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Failed to fetch destinations for ${subscription.subdomain}`
    );
  }

  return response.json();
}

/**
 * Return all SaaS subscriptions.
 */
app.get("/subscriptions", async (req, res) => {
  try {
    res.json(await getSubscriptions());
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * For every subscribed consumer:
 *
 * SaaS Registry
 *      ↓
 * tenant ID + subdomain
 *      ↓
 * subscriber Destination token
 *      ↓
 * Destination Service
 *      ↓
 * subscriber destinations
 */
app.get("/destinations", async (req, res) => {
  try {
    const subscriptions = await getSubscriptions();
    const results = [];

    for (const subscription of subscriptions) {
      try {
        const destinations =
          await getDestinations(subscription);

        results.push({
          tenantId: subscription.consumerTenantId,
          subdomain: subscription.subdomain,
          destinations,
        });
      } catch (error) {
        // One failing tenant should not stop the others.
        results.push({
          tenantId: subscription.consumerTenantId,
          subdomain: subscription.subdomain,
          error: error.message,
        });
      }
    }

    res.json(results);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Destination Reader running on port ${PORT}`);
});