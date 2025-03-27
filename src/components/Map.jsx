import React, { useEffect, useRef, useState } from "react";
import { loadModules } from "esri-loader";
import AddLocationWidget from "./AddLocationWidget";
import "../style/Map.css";

const NearestLocationMap = () => {
  const mapRef = useRef();
  const [userLocation, setUserLocation] = useState(null);
  const [nearestPoint, setNearestPoint] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNaloxoneOnly, setShowNaloxoneOnly] = useState(false);
  const [viewInstance, setViewInstance] = useState(null);


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
        setViewInstance(view);

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
          query.where = showNaloxoneOnly ? "Naloxone_Strips = 1" : "1=1";

          queryTask.execute(query).then((result) => {
            view.graphics.removeAll();

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
                symbol: {
                  type: "simple-marker",
                  color: nearest.attributes.Naloxone_Strips === 1 ? "yellow" : "red",
                  size: "12px",
                },
                attributes: nearest.attributes,
                popupTemplate: {
                  title: nearest.attributes.name || "Addiction Center",
                  content: Object.keys(nearest.attributes)
                    .map((key) => {
                      const value =
                        key === "Naloxone_Strips"
                          ? nearest.attributes[key] === 1
                            ? "Yes"
                            : "No"
                          : nearest.attributes[key] ?? "N/A";
                      return `<p><strong>${key}:</strong> ${value}</p>`;
                    })
                    .join(""),
                },
              });

              view.graphics.addMany([userGraphic, nearestGraphic]);

              result.features.forEach((feature) => {
                if (feature !== nearest) {
                  const hasNaloxone = feature.attributes.Naloxone_Strips === 1;

                  const featureGraphic = new Graphic({
                    geometry: feature.geometry,
                    symbol: {
                      type: "simple-marker",
                      color: hasNaloxone ? "yellow" : "gray",
                      size: "8px",
                    },
                    attributes: feature.attributes,
                    popupTemplate: {
                      title: feature.attributes.name || "Addiction Center",
                      content: Object.keys(feature.attributes)
                        .map((key) => {
                          const value =
                            key === "Naloxone_Strips"
                              ? feature.attributes[key] === 1
                                ? "Yes"
                                : "No"
                              : feature.attributes[key] ?? "N/A";
                          return `<p><strong>${key}:</strong> ${value}</p>`;
                        })
                        .join(""),
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
  }, [userLocation, showNaloxoneOnly]);

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

          <div className="form-check mt-3">
            <input
              className="form-check-input"
              type="checkbox"
              checked={showNaloxoneOnly}
              onChange={() => setShowNaloxoneOnly((prev) => !prev)}
              id="naloxoneToggle"
            />
            <label className="form-check-label" htmlFor="naloxoneToggle">
              Show Only Naloxone Locations
            </label>
          </div>

          <hr className="my-3" />
          <h2 className="h6 fw-bold mb-2">Legend</h2>
          <ul className="list-unstyled small">
            <li className="d-flex align-items-center mb-2">
              <span
                style={{
                  width: 15,
                  height: 15,
                  backgroundColor: "yellow",
                  display: "inline-block",
                  marginRight: 8,
                }}
              ></span>
              Naloxone Available
            </li>
            <li className="d-flex align-items-center mb-2">
              <span
                style={{
                  width: 15,
                  height: 15,
                  backgroundColor: "red",
                  display: "inline-block",
                  marginRight: 8,
                }}
              ></span>
              Nearest Location
            </li>
            <li className="d-flex align-items-center">
              <span
                style={{
                  width: 15,
                  height: 15,
                  backgroundColor: "gray",
                  display: "inline-block",
                  marginRight: 8,
                }}
              ></span>
              Other Locations
            </li>
          </ul>
            <AddLocationWidget
            view={viewInstance}
            onFeatureAdded={() => setUserLocation([...userLocation])}
            />
        </aside>

        <main className="flex-grow-1 p-3">
          <div
            ref={mapRef}
            className="rounded shadow"
            style={{ width: "100%", height: "100%" }}
          />
        </main>
      </div>
    </div>
  );
};

export default NearestLocationMap;
