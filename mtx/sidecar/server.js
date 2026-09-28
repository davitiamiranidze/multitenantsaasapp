const cds = require("@sap/cds");

cds.on("served", () => {
  const ds = cds.services["cds.xt.DeploymentService"];

  ds.after("subscribe", async (result, req) => {
    console.log("SUBSCRIPTION DATA:");
    console.dir(req.data, { depth: null });

    const { tenant, metadata } = req.data;

    console.log("Tenant ID:", tenant);
    console.log("Metadata:", metadata);
  });
});