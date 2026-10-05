# Destination Reader

Node.js service used to read SAP BTP subscriber information, destinations and XSUAA information in the multitenant SaaS application.

## Required BTP Services

The Destination Reader uses the following Cloud Foundry service instances:

- `my-saas-destination-service`
- `my-saas-auth`
- `my-saas-registry`
- `my-saas-xsuaa-api`

## 1. Check Cloud Foundry Target

Make sure BAS is connected to the correct Cloud Foundry org and space.

```bash
cf target
```

If necessary:

```bash
cf login
```

You can check the available services with:

```bash
cf services
```

## 2. Install Dependencies

From the `destination-reader` directory:

```bash
npm install
```

## 3. Configure Local BTP Bindings

Run the following commands:

```bash
cds bind -2 my-saas-destination-service
cds bind -2 my-saas-auth
cds bind -2 my-saas-registry
cds bind -2 my-saas-xsuaa-api
```

These bindings allow the locally running Node.js application to use the real SAP BTP Cloud Foundry services.

The bindings only need to be configured initially unless the service configuration changes.

To inspect the hybrid bindings:

```bash
cds env get requires --profile hybrid
```

## 4. Start Locally

Port `3000` is already used/intercepted in the BAS environment, so local development uses port `4005`.

Start the Destination Reader with:

```bash
npm run start:local
```

Equivalent command:

```bash
PORT=4005 cds bind --exec -- npm start
```

Expected output:

```text
resolving cloud service bindings...

bound my-saas-registry to cf managed service ...
bound destinations to cf managed service ...
bound auth to cf managed service ...

Destination Reader running on port 4005
```

Keep this terminal running.

## 5. Test the Service

Open a second BAS terminal.

### Get subscribed tenants

```bash
npm run test:tenants
```

Equivalent:

```bash
curl -i http://127.0.0.1:4005/tenants
```

Endpoint:

```text
GET /tenants
```

This retrieves subscriptions from the SaaS Registry.

---

### Get destinations for all subscribers

```bash
npm run test:destinations
```

Equivalent:

```bash
curl -i http://127.0.0.1:4005/tenants-destinations
```

Endpoint:

```text
GET /tenants-destinations
```

The service:

1. Retrieves subscriptions from SaaS Registry.
2. Determines each subscriber subdomain.
3. Creates the subscriber issuer URL.
4. Calls SAP Destination Service using the subscriber context.
5. Returns destinations for every subscriber.

---

### Get subscriber XSUAA tokens

```bash
npm run test:tokens
```

Equivalent:

```bash
curl -i http://127.0.0.1:4005/xsuaa-subscriber-tokens
```

Endpoint:

```text
GET /xsuaa-subscriber-tokens
```

For every subscribed tenant, the service requests a client-credentials token from the subscriber XSUAA tenant and returns selected decoded token information.

---

### Get provider role collections

```bash
npm run test:roles
```

Equivalent:

```bash
curl -i http://127.0.0.1:4005/provider-role-collections
```

Endpoint:

```text
GET /provider-role-collections
```

This uses the `my-saas-xsuaa-api` service instance and attempts to access the XSUAA Authorization API.

---

## 6. Run All Tests

With the Destination Reader running in another terminal:

```bash
npm run test:all
```

This executes:

```text
/tenants
/tenants-destinations
/xsuaa-subscriber-tokens
/provider-role-collections
```

## Normal Development Workflow

### Terminal 1

```bash
cd /home/user/projects/multitenantsaasapp/destination-reader

npm run start:local
```

### Terminal 2

```bash
cd /home/user/projects/multitenantsaasapp/destination-reader

npm run test:tenants
```

or:

```bash
npm run test:destinations
```

or:

```bash
npm run test:tokens
```

or:

```bash
npm run test:roles
```

or run everything:

```bash
npm run test:all
```

## Restart After Code Changes

After changing `server.js`, stop the running server:

```text
Ctrl+C
```

Then start it again:

```bash
npm run start:local
```

No MTA rebuild or Cloud Foundry deployment is required for local testing.

## Local URLs

Inside the BAS dev space:

```text
http://127.0.0.1:4005/tenants

http://127.0.0.1:4005/tenants-destinations

http://127.0.0.1:4005/xsuaa-subscriber-tokens

http://127.0.0.1:4005/provider-role-collections
```

Do not use `localhost:3000` for this project in BAS because port `3000` is already being used/intercepted by another service.