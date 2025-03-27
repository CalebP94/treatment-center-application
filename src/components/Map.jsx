import React, { useEffect, useRef, useState } from "react";
import { loadModules } from "esri-loader";
import "../style/Map.css";

const NearestLocationMap = () => {
  const mapRef = useRef();
  const [userLocation, setUserLocation] = useState(null);
  const [nearestPoint, setNearestPoint] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserLocation([longitude, latitude]);
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert("Unable to retrieve your location. Using default location.");
          setUserLocation([-81.0348, 34.0007]); // Default Columbia, SC
        }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
      setUserLocation([-81.0348, 34.0007]); // Default Columbia, SC
    }
  }, []);

  useEffect(() => {
    if (!userLocation) return;

    setIsLoading(true);

    loadModules(
      [
        "esri/Map",
        "esri/views/MapView",
        "esri/tasks/QueryTask",
        "esri/tasks/support/Query",
        "esri/geometry/Point",
        "esri/geometry/geometryEngine",
        "esri/geometry/projection",
        "esri/geometry/SpatialReference",
        "esri/Graphic",
      ],
      { css: true }
    ).then(
      ([
        Map,
        MapView,
        QueryTask,
        Query,
        Point,
        geometryEngine,
        projection,
        SpatialReference,
        Graphic,
      ]) => {
        const map = new Map({ basemap: "streets-navigation-vector" });

        const view = new MapView({
          container: mapRef.current,
          map,
          center: userLocation,
          zoom: 10,
        });

        const userPoint = new Point({
          longitude: userLocation[0],
          latitude: userLocation[1],
          spatialReference: { wkid: 4326 },
        });

        projection.load().then(() => {
          const projectedUserPoint = projection.project(
            userPoint,
            new SpatialReference({ wkid: 3857 })
          );

          const queryTask = new QueryTask({
            url: "https://services6.arcgis.com/2H5E7Y0F3MHolxq0/arcgis/rest/services/Addiction_Centers/FeatureServer/0",
          });

          const query = new Query();
          query.returnGeometry = true;
          query.outFields = ["*"];
          query.where = "1=1";

          queryTask.execute(query).then((result) => {
            if (result.features.length > 0) {
              const nearest = result.features.reduce((prev, curr) => {
                const prevProjected = projection.project(
                  prev.geometry,
                  new SpatialReference({ wkid: 3857 })
                );
                const currProjected = projection.project(
                  curr.geometry,
                  new SpatialReference({ wkid: 3857 })
                );

                const prevDist = geometryEngine.distance(
                  projectedUserPoint,
                  prevProjected,
                  "meters"
                );
                const currDist = geometryEngine.distance(
                  projectedUserPoint,
                  currProjected,
                  "meters"
                );

                return currDist < prevDist ? curr : prev;
              });

              const nearestPointGeometry = nearest.geometry;
              setNearestPoint(nearestPointGeometry);

              const userGraphic = new Graphic({
                geometry: userPoint,
                symbol: { type: "simple-marker", color: "blue", size: "12px" },
              });

              const nearestGraphic = new Graphic({
                geometry: nearestPointGeometry,
                symbol: { type: "simple-marker", color: "red", size: "12px" },
                attributes: nearest.attributes,
                popupTemplate: {
                  title: nearest.attributes.name || "Addiction Center",
                  content: `
                    <p><strong>Address:</strong> ${
                      nearest.attributes.address || "N/A"
                    }</p>
                    <p><strong>City:</strong> ${nearest.attributes.city || "N/A"}</p>
                  `,
                },
              });

              view.graphics.addMany([userGraphic, nearestGraphic]);

              // Add all other features to the map
              result.features.forEach((feature) => {
                if (feature !== nearest) {
                  const featureGraphic = new Graphic({
                    geometry: feature.geometry,
                    symbol: { type: "simple-marker", color: "gray", size: "8px" },
                    attributes: feature.attributes,
                    popupTemplate: {
                      title: feature.attributes.name || "Addiction Center",
                      content: `
                        <p><strong>Address:</strong> ${
                          feature.attributes.address || "N/A"
                        }</p>
                        <p><strong>City:</strong> ${feature.attributes.city || "N/A"}</p>
                      `,
                    },
                  });
                  view.graphics.add(featureGraphic);
                }
              });

              view.popup.open({
                location: nearestPointGeometry,
                features: [nearestGraphic],
              });
            }
          });
        });
      }
    ).finally(() => setIsLoading(false));
  }, [userLocation]);

  const handleDirectionsClick = () => {
    if (!nearestPoint) {
      alert("Nearest location not found yet.");
      return;
    }

    const gmapUrl = `https://www.google.com/maps/dir/?api=1&origin=${userLocation[1]},${userLocation[0]}&destination=${nearestPoint.latitude},${nearestPoint.longitude}`;
    window.open(gmapUrl, "_blank");
  };

  return (
    <div className="d-flex flex-column vh-100">
      <header className="bg-dark text-white p-3 shadow-sm">
        <h1 className="h5 m-0">Recovery Resource Locator</h1>
      </header>
      <div className="d-flex flex-grow-1 overflow-hidden">
        <aside
          className="bg-light p-4 shadow-sm"
          style={{ width: "300px", overflowY: "auto" }}
        >
          <h2 className="h6 fw-bold mb-3">Toolbar</h2>
          <button
            className="btn btn-primary w-100"
            onClick={handleDirectionsClick}
            disabled={isLoading}
          >
            {isLoading ? "Loading..." : "Get Directions"}
          </button>
        </aside>
        <main className="flex-grow-1 p-3">
          <div ref={mapRef} className="rounded shadow" style={{ width: "100%", height: "100%" }} />
        </main>
      </div>
    </div>
  );
};

export default NearestLocationMap;