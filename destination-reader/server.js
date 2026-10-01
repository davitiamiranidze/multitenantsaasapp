const express = require("express");

const {
  decodeJwt,
  getServiceBinding,
  serviceToken,
  getAllDestinationsFromDestinationService,
} = require("@sap-cloud-sdk/connectivity");

const app = express();

/**
 * Fetch all consumer tenants currently subscribed
 * to our multitenant SaaS application.
 *
 * Flow:
 * SaaS Registry binding
 *      ↓
 * Service token
 *      ↓
 * SaaS Registry API
 *      ↓
 * List of subscribed consumers
 *
 * Each subscription contains information such as:
 * - consumerTenantId -> subscriber tenant ID (zid)
 * - subdomain        -> subscriber subdomain
 */
async function getSubscriptions() {
  // Get the SaaS Registry service binding from the environment.
  const registry = getServiceBinding("saas-registry");

  // Get a technical service-to-service access token
  // for calling the SaaS Registry API.
  const token = await serviceToken("saas-registry");

  // SaaS Registry API base URL.
  const baseUrl =
    registry.credentials.saas_registry_url ||
    registry.credentials.url;

  // Fetch all subscriptions of this SaaS application.
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
 * Build the XSUAA issuer URL (iss) for a subscriber.
 *
 * The Destination service binding contains the provider's
 * XSUAA URL, for example:
 *
 * https://provider.authentication.us10.hana.ondemand.com
 *
 * We remove the provider subdomain:
 *
 * authentication.us10.hana.ondemand.com
 *
 * and replace it with the subscriber subdomain:
 *
 * https://consumer.authentication.us10.hana.ondemand.com
 *
 * The Cloud SDK uses this issuer to determine which
 * subscriber tenant context should be used.
 */
function getSubscriberIss(subscription) {
  const destination = getServiceBinding("destination");

  // Extract the authentication domain from the provider URL.
  const authDomain = new URL(destination.credentials.url)
    .hostname
    .split(".")
    .slice(1)
    .join(".");

  // Construct the subscriber-specific XSUAA issuer.
  return `https://${subscription.subdomain}.${authDomain}`;
}

/**
 * Fetch all subaccount-level destinations belonging
 * to a specific subscriber.
 *
 * Instead of manually:
 *
 * 1. Requesting a Destination Service token
 * 2. Calling /destination-configuration/v1/subaccountDestinations
 *
 * we give the subscriber issuer to the SAP Cloud SDK.
 *
 * The SDK handles the Destination Service authentication
 * and request internally in the subscriber tenant context.
 */
async function getDestinations(subscription) {
  const iss = getSubscriberIss(subscription);

  return getAllDestinationsFromDestinationService({
    iss,
  });
}

/**
 * Return all SaaS subscriptions.
 */
app.get("/subscriptions", async (req, res) => {
  try {
    const subscriptions = await getSubscriptions();

    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

/**
 * Return destinations for every subscribed consumer.
 *
 * Flow:
 *
 * SaaS Registry
 *      ↓
 * List of subscriptions
 *      ↓
 * subscriber subdomain
 *      ↓
 * Build subscriber XSUAA issuer (iss)
 *      ↓
 * SAP Cloud SDK
 *      ↓
 * Destination Service
 *      ↓
 * Subscriber's destinations
 *
 * Each subscriber is handled separately so that an error
 * for one tenant does not prevent other tenants from
 * being processed.
 */
app.get("/destinations", async (req, res) => {
  try {
    const subscriptions = await getSubscriptions();
    const results = [];

    for (const subscription of subscriptions) {
      try {
        // Fetch destinations in this subscriber's tenant context.
        const destinations =
          await getDestinations(subscription);

        results.push({
          tenantId: subscription.consumerTenantId,
          subdomain: subscription.subdomain,
          destinations,
        });
      } catch (error) {
        // Keep processing the remaining subscribers
        // even if this subscriber fails.
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


app.get("/role-collections", async (req, res) => {
  try {
    // Get the XSUAA apiaccess binding
    const binding = getServiceBinding("xsuaa", {
      serviceInstanceName: "my-saas-xsuaa-api",
    });

    // Get client_credentials token from that same XSUAA instance
    const token = await serviceToken("xsuaa", {
      serviceBindingOptions: {
        serviceInstanceName: "my-saas-xsuaa-api",
      },
    });

    // Call XSUAA Role Collections API
    const response = await fetch(
      `${binding.credentials.apiurl}/sap/rest/authorization/v2/rolecollections`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    if (!response.ok) {
      const error = await response.text();

      return res.status(response.status).json({
        error: "Failed to fetch role collections",
        details: error,
      });
    }

    const roleCollections = await response.json();

    res.json({
      roleCollections,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: error.message,
    });
  }
});

// Cloud Foundry provides PORT automatically.
// 3000 is used when running locally.
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Destination Reader running on port ${PORT}`);
});