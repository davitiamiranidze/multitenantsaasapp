const express = require("express");

const {
  decodeJwt,
  getServiceBinding,
  serviceToken,
  getAllDestinationsFromDestinationService,
} = require("@sap-cloud-sdk/connectivity");

const app = express();

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function mapToken(token) {
  const decoded = decodeJwt(token);

  return {
    zid: decoded.zid,
    iss: decoded.iss,
    client_id: decoded.client_id,
    grant_type: decoded.grant_type,
    scope: decoded.scope,
    authorities: decoded.authorities,
  };
}

function getXsuaaBinding() {
  return getServiceBinding("xsuaa", {
    serviceInstanceName: "my-saas-xsuaa-api",
  });
}

function getSubscriberUrl(subscription, binding) {
  const providerUrl = new URL(binding.credentials.url);

  const authDomain = providerUrl.hostname
    .split(".")
    .slice(1)
    .join("."); 

  return `https://${subscription.subdomain}.${authDomain}`;
}

/* -------------------------------------------------------------------------- */
/* SaaS Registry                                                              */
/* -------------------------------------------------------------------------- */

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
    const error = await response.text();

    throw new Error(
      `Failed to fetch subscriptions: ${response.status} ${error}`
    );
  }

  const data = await response.json();

  return data.subscriptions;
}

/* -------------------------------------------------------------------------- */
/* Destination Service                                                        */
/* -------------------------------------------------------------------------- */

function getSubscriberIss(subscription) {
  const destinationBinding =
    getServiceBinding("destination");

  return getSubscriberUrl(
    subscription,
    destinationBinding
  );
}

async function getDestinations(subscription) {
  const iss = getSubscriberIss(subscription);

  return getAllDestinationsFromDestinationService({
    iss,
  });
}

/* -------------------------------------------------------------------------- */
/* XSUAA                                                                      */
/* -------------------------------------------------------------------------- */

async function getProviderXsuaaToken() {
  return serviceToken("xsuaa", {
    serviceBindingOptions: {
      serviceInstanceName: "my-saas-xsuaa-api",
    },
  });
}

async function getSubscriberXsuaaToken(subscription) {
  const binding = getXsuaaBinding();

  const subscriberUrl = getSubscriberUrl(
    subscription,
    binding
  );

  const credentials = Buffer.from(
    `${binding.credentials.clientid}:${binding.credentials.clientsecret}`
  ).toString("base64");

  const response = await fetch(
    `${subscriberUrl}/oauth/token`,
    {
      method: "POST",

      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body: new URLSearchParams({
        grant_type: "client_credentials",
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();

    throw new Error(
      `Failed to get XSUAA token for ${subscription.subdomain}: ` +
      `${response.status} ${error}`
    );
  }

  const data = await response.json();

  return data.access_token;
}

async function getRoleCollections(token) {
  const binding = getXsuaaBinding();

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

    throw new Error(
      `Failed to fetch role collections: ` +
      `${response.status} ${error}`
    );
  }

  return response.json();
}

/* -------------------------------------------------------------------------- */
/* Routes                                                                     */
/* -------------------------------------------------------------------------- */

app.get("/tenants", async (req, res) => {
  try {
    const subscriptions = await getSubscriptions();

    res.json(subscriptions);
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/tenants-destinations", async (req, res) => {
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

app.get("/provider-role-collections", async (req, res) => {
  try {
    const token = await getProviderXsuaaToken();

    const roleCollections =
      await getRoleCollections(token);

    res.json({
      token: mapToken(token),
      roleCollections,
    });
  } catch (error) {
    res.status(500).json({
      error: error.message,
    });
  }
});

app.get("/xsuaa-subscriber-tokens", async (req, res) => {
  try {
    const subscriptions = await getSubscriptions();

    const results = [];

    for (const subscription of subscriptions) {
      try {
        const token =
          await getSubscriberXsuaaToken(subscription);

        results.push({
          subdomain: subscription.subdomain,
          consumerTenantId:
            subscription.consumerTenantId,
          token: mapToken(token),
        });
      } catch (error) {
        results.push({
          subdomain: subscription.subdomain,
          consumerTenantId:
            subscription.consumerTenantId,
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

/* -------------------------------------------------------------------------- */
/* Server                                                                     */
/* -------------------------------------------------------------------------- */

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(
    `Destination Reader running on port ${PORT}`
  );
});