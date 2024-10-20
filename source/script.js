require([
    "esri/Map",
    "esri/views/MapView",
    "esri/layers/FeatureLayer",
    "esri/widgets/Search",
    "esri/Graphic",
    "esri/tasks/support/Query",
    "esri/layers/GraphicsLayer"
], function(Map, MapView, FeatureLayer, Search, Graphic, Query, GraphicsLayer) {

    // Create the map. First part of very web map
    var map = new Map({
        basemap: "gray-vector"
    });

    // Create the view to display the map and all other map visuals.
    var view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-123.3656, 50.4284], 
        zoom: 5
    });

    // Add the BC school districts layer with custom symbology. There is no fill so the basemap can be seen
    var schoolDistrictsLayer = new FeatureLayer({
        url: "https://services.arcgis.com/E5vyYQKPMX5X3R3H/arcgis/rest/services/School_districts/FeatureServer",
        outFields: ["*"],
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-fill",
                color: [0, 0, 0, 0], // No fill color
                outline: {
                    color: [105, 105, 105], // Deep grey
                    width: 1.5 //Width of polygon outline
                }
            }
        }
    });
    map.add(schoolDistrictsLayer);

    // Define the popup template for the schools layer. This is for selected attributes in the schools data.
    const popupTemplate = {
        title: "School Information",
        content: [
            {
                type: "fields",
                fieldInfos: [
                    { fieldName: "STREET_ADD", label: "Street Address" },
                    { fieldName: "EARLY_FREN", label: "Early French" },
                    { fieldName: "CORE_FRENC", label: "Core French" },
                    { fieldName: "FRANCOPHON", label: "Francophone" },
                    { fieldName: "LATE_FRENC", label: "Late French" },
                    { fieldName: "SCHOOL_CAT", label: "School Category" },
                    { fieldName: "SCHOOL_EDU", label: "School Education" }
                ]
            }
        ]
    };

    // Add the schools layer with custom symbology and popup template
    var schoolsLayer = new FeatureLayer({
        url: "https://services.arcgis.com/E5vyYQKPMX5X3R3H/arcgis/rest/services/Schools1/FeatureServer",
        outFields: ["*"],
        renderer: {
            type: "simple",
            symbol: {
                type: "simple-marker",
                color: "black",
                size: "8px"
            }
        },
        popupTemplate: popupTemplate
    });
    map.add(schoolsLayer);

    // Create a graphics layer for the highlighted polygon. This is to ensure the select school district cna be easily distinguished. A bloom effec is also added
    var highlightLayer = new GraphicsLayer({
        effect: "bloom(2.5, 0.5px, 15%)" // Bloom effect
    });
    map.add(highlightLayer);

    // Create the search widget for address search
    var search = new Search({
        view: view,
        container: "searchDiv"
    });

    // Populate dropdowns with unique field values
    function populateDropdowns() {
        // Query for unique SCHOOL_CAT values
        const schoolCatQuery = schoolsLayer.createQuery();
        schoolCatQuery.returnDistinctValues = true; // Ensure we only get distinct values
        schoolCatQuery.outFields = ["SCHOOL_CAT"];

        schoolsLayer.queryFeatures(schoolCatQuery).then(function(result) {
            const uniqueSchoolCatValues = new Set();
            result.features.forEach(function(feature) {
                uniqueSchoolCatValues.add(feature.attributes.SCHOOL_CAT);
            });

            const schoolCatSelect = document.getElementById("schoolCat");
            uniqueSchoolCatValues.forEach(function(value) {
                const option = document.createElement("option");
                option.value = value;
                option.text = value;
                schoolCatSelect.add(option);
            });
        });

        // Query for unique EARLY_FREN values
        const earlyFrenQuery = schoolsLayer.createQuery();
        earlyFrenQuery.returnDistinctValues = true; // Ensure we only get distinct values
        earlyFrenQuery.outFields = ["EARLY_FREN"];

        schoolsLayer.queryFeatures(earlyFrenQuery).then(function(result) {
            const uniqueEarlyFrenValues = new Set();
            result.features.forEach(function(feature) {
                uniqueEarlyFrenValues.add(feature.attributes.EARLY_FREN);
            });

            const earlyFrenSelect = document.getElementById("earlyFren");
            uniqueEarlyFrenValues.forEach(function(value) {
                const option = document.createElement("option");
                option.value = value;
                option.text = value;
                earlyFrenSelect.add(option);
            });
        });

        // Query for unique SCHOOL_EDU values
        const schoolEduQuery = schoolsLayer.createQuery();
        schoolEduQuery.returnDistinctValues = true; // Ensure we only get distinct values
        schoolEduQuery.outFields = ["SCHOOL_EDU"];

        schoolsLayer.queryFeatures(schoolEduQuery).then(function(result) {
            const uniqueSchoolEduValues = new Set();
            result.features.forEach(function(feature) {
                uniqueSchoolEduValues.add(feature.attributes.SCHOOL_EDU);
            });

            const schoolEduSelect = document.getElementById("schoolEdu");
            uniqueSchoolEduValues.forEach(function(value) {
                const option = document.createElement("option");
                option.value = value;
                option.text = value;
                schoolEduSelect.add(option);
            });
        });
    }

    // Call the function to populate the dropdowns
    populateDropdowns();

    // Handle search results
    search.on("select-result", function(event) {
        var geometry = event.result.feature.geometry;

        // Query the school districts layer to find the district containing the address
        var query = schoolDistrictsLayer.createQuery();
        query.geometry = geometry;
        query.spatialRelationship = "intersects";
        query.returnGeometry = true;
        query.outFields = ["*"];

        schoolDistrictsLayer.queryFeatures(query).then(function(result) {
            if (result.features.length > 0) {
                var district = result.features[0];

                // Zoom to the district
                view.goTo(district.geometry.extent);

                // Highlight the district with bloom effect
                var highlightGraphic = new Graphic({
                    geometry: district.geometry,
                    symbol: {
                        type: "simple-fill",
                        color: [0, 0, 0, 0], // No fill color
                        outline: {
                            color: [255, 0, 0], // Red outline
                            width: 1.5 // Thicker outline
                        }
                    }
                });
                highlightLayer.removeAll();
                highlightLayer.add(highlightGraphic);

                // Query and display schools within the district
                querySchoolsInDistrict(district.geometry);
            }
        });
    });

    // Query and display schools within the district
    function querySchoolsInDistrict(districtGeometry) {
        const query = schoolsLayer.createQuery();
        query.geometry = districtGeometry;
        query.spatialRelationship = "contains"; // Ensure we only get schools within the district
        query.returnGeometry = true; // Get the school geometries in the result

        schoolsLayer.queryFeatures(query).then(function(result) {
            // Filter schools to show only those in the district
            if (result.features.length > 0) {
                schoolsLayer.definitionExpression = "OBJECTID IN (" + result.features.map(f => f.attributes.OBJECTID).join(",") + ")";
            } else {
                // Clear the filter if no schools are found
                schoolsLayer.definitionExpression = "1=0"; // This will hide all schools if none are found
            }
        });
    }

    // Filter schools based on the user input
    document.getElementById("filter-btn").addEventListener("click", function() {
        const schoolCat = document.getElementById("schoolCat").value;
        const earlyFren = document.getElementById("earlyFren").value;
        const schoolEdu = document.getElementById("schoolEdu").value;

        let filterExpression = "1=1"; // Start with a true expression

        // Apply the filter based on user selections
        if (schoolCat) filterExpression += ` AND SCHOOL_CAT = '${schoolCat}'`;
        if (earlyFren) filterExpression += ` AND EARLY_FREN = '${earlyFren}'`;
        if (schoolEdu) filterExpression += ` AND SCHOOL_EDU = '${schoolEdu}'`;

        // Update the schools layer definition expression with the filter
        schoolsLayer.definitionExpression = filterExpression;
    });
});