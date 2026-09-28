namespace my.saas;

entity Products {
    key ID    : UUID;
        name  : String;
        price : Decimal(9, 2);
}

entity Tenants {
    key tenantId     : String(255);
        subdomain    : String(255);
        issuer       : String(500);
        active       : Boolean default true;
        subscribedAt : Timestamp;
}
