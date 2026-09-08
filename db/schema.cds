namespace my.saas;

entity Products {
    key ID    : UUID;
        name  : String;
        price : Decimal(9, 2);
}
