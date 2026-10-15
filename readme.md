# My SaaS – Multitenant CAP Application

## Getting Started

This project is a multitenant SaaS application built with SAP Cloud Application Programming Model (CAP) and SAP Business Technology Platform (BTP).

The application uses an MTX Sidecar for multitenancy and tenant provisioning, and integrates with SAP BTP services such as XSUAA, SaaS Registry, and Destination Service.

## Project Structure

| File or Folder | Purpose |
|---|---|
| `app/` | UI frontend applications |
| `db/` | Domain models and database definitions |
| `srv/` | CAP services and business logic |
| `mtx/sidecar/` | Multitenancy and tenant provisioning |
| `destination-reader/` | Microservice for retrieving subscriber information and destinations |
| `mta.yaml` | SAP BTP deployment configuration |
| `package.json` | Project dependencies, scripts, and CAP configuration |

## Prerequisites

Before running the application locally, ensure that the following are installed:

- Node.js and npm
- SAP CDS Development Kit (`@sap/cds-dk`)
- SAP BTP Cloud Foundry CLI (for hybrid development)
- Required project dependencies

Install dependencies from the project root:

```bash
npm install
```

## Running the Application Locally

### 1. Start the CAP Application with Multitenancy

From the project root, run:

```bash
npx cds watch --profile with-mtx
```

This starts the CAP application with the multitenancy profile and MTX Sidecar, provided the sidecar is configured correctly.

Typical local endpoints:

| Component | URL |
|---|---|
| CAP Application | `http://localhost:4004` |
| MTX Sidecar | `http://localhost:4005` |

Check the terminal output to confirm the actual ports.

### 2. Create Local Test Tenants

Open a separate terminal and run:

```bash
npx cds subscribe t1 --to http://localhost:4005
npx cds subscribe t2 --to http://localhost:4005
```

These commands provision local test tenants using the MTX Sidecar.

The project defines mocked authentication users for local development:

| User | Tenant |
|---|---|
| `alice` | `t1` |
| `bob` | `t2` |

Use these users to test tenant isolation and tenant-specific data access.

### 3. Access the Application

Once the application is running, open:

```text
http://localhost:4004
```

The available CAP services and application routes will be displayed.

You can also access the UI applications through their configured local routes.

## Running with SAP BTP Services

For hybrid development, SAP BTP service instances can be bound to the local application using `cds bind`.

After configuring the required service bindings, run:

```bash
cds bind --exec -- cds watch
```

This allows the locally running application to use configured SAP BTP service credentials.

Real SaaS subscriptions, subscriber authentication, and tenant-specific cloud resources require the appropriate SAP BTP configuration.

## Destination Reader

The project includes a separate `destination-reader` microservice responsible for retrieving SaaS subscriber information and accessing SAP BTP Destination Service.

Detailed setup instructions, service bindings, available endpoints, and local testing procedures are documented in:

**[`destination-reader/README.md`](destination-reader/README.md)**

Refer to that README for instructions on running and testing the Destination Reader independently.

## Deployment

Build the MTA archive:

```bash
npm run build
```

Deploy the application to SAP BTP Cloud Foundry:

```bash
npm run deploy
```

Ensure the required SAP BTP services and deployment configuration are available before deployment.

## Learn More

- [SAP CAP Documentation](https://cap.cloud.sap)
- [SAP BTP Documentation](https://help.sap.com/docs/btp)
