import JourneyRunner from "sap/fe/test/JourneyRunner";
import ListReport from "sap/fe/test/ListReport";
import ObjectPage from "sap/fe/test/ObjectPage";
import CustomProductsListGenerated from "./ProductsList.gen";
import CustomProductsObjectPageGenerated from "./ProductsObjectPage.gen";

const runner = new JourneyRunner({
    launchUrl: sap.ui.require.toUrl("catalog/project1") + "/test/flp.html#app-preview",
    pages: {
        onTheProductsListGenerated: new ListReport(
            {
                appId: "catalog.project1",
                componentId: "ProductsList",
                entitySet: "",
                contextPath: "/Products"
            },
            CustomProductsListGenerated
        ),
        onTheProductsObjectPageGenerated: new ObjectPage(
            {
                appId: "catalog.project1",
                componentId: "ProductsObjectPage",
                entitySet: "",
                contextPath: "/Products"
            },
            CustomProductsObjectPageGenerated
        )
    },
    async: true
});

export default runner;
