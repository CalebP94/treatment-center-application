import React, { useState } from "react";

const AddLocationWidget = ({ view, onFeatureAdded }) => {
  const [form, setForm] = useState({
    streetNumber: "",
    streetName: "",
    state: "",
    zipCode: "",
    name: "",
    Naloxone_Strips: 0,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const buildAddressString = () => {
    return `${form.streetNumber} ${form.streetName}, ${form.state} ${form.zipCode}`;
  };

  const geocodeAndSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const fullAddress = buildAddressString();

    try {
      // Step 1: Geocode
      const params = new URLSearchParams({
        f: "json",
        SingleLine: fullAddress,
        outFields: "*",
      });

      const geocodeRes = await fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates?${params}`
      );

      const geocodeData = await geocodeRes.json();

      if (!geocodeData.candidates.length) {
        setError("Address not found. Please try a different one.");
        setIsSubmitting(false);
        return;
      }

      const topCandidate = geocodeData.candidates[0];
      const point = {
        type: "point",
        longitude: topCandidate.location.x,
        latitude: topCandidate.location.y,
        spatialReference: { wkid: 4326 },
      };

      // Step 2: Submit to Feature Service
      const newFeature = {
        attributes: {
          name: form.name,
          Naloxone_Strips: form.Naloxone_Strips,
        },
        geometry: {
          x: point.longitude,
          y: point.latitude,
          spatialReference: { wkid: 4326 },
        },
      };

      const addRes = await fetch(
        "https://services6.arcgis.com/2H5E7Y0F3MHolxq0/arcgis/rest/services/Addiction_Centers/FeatureServer/0/addFeatures",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            f: "json",
            features: JSON.stringify([newFeature]),
          }),
        }
      );

      const addData = await addRes.json();

      if (addData.addResults?.[0]?.success) {
        alert("Location added successfully!");

        // Step 3: Visual feedback on map
        view?.graphics.removeAll();
        view?.graphics.add({
          geometry: point,
          symbol: { type: "simple-marker", color: "green", size: "12px" },
        });
        view?.goTo(point);

        // Reset form
        setForm({
          streetNumber: "",
          streetName: "",
          state: "",
          zipCode: "",
          name: "",
          Naloxone_Strips: 0,
        });

        onFeatureAdded();
      } else {
        throw new Error("Feature service error");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to submit location.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-4">
      <h2 className="h6 fw-bold mb-2">Add New Location</h2>

      <form onSubmit={geocodeAndSubmit}>
        <div className="mb-2">
          <label className="form-label">Street Number</label>
          <input
            className="form-control"
            type="text"
            value={form.streetNumber}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, streetNumber: e.target.value }))
            }
            required
          />
        </div>

        <div className="mb-2">
          <label className="form-label">Street Name</label>
          <input
            className="form-control"
            type="text"
            value={form.streetName}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, streetName: e.target.value }))
            }
            required
          />
        </div>

        <div className="mb-2">
          <label className="form-label">State</label>
          <input
            className="form-control"
            type="text"
            value={form.state}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, state: e.target.value }))
            }
            required
          />
        </div>

        <div className="mb-2">
          <label className="form-label">Zip Code</label>
          <input
            className="form-control"
            type="text"
            value={form.zipCode}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, zipCode: e.target.value }))
            }
            required
          />
        </div>

        <hr />

        <div className="mb-2">
          <label className="form-label">Location Name</label>
          <input
            className="form-control"
            type="text"
            value={form.name}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, name: e.target.value }))
            }
            required
          />
        </div>

        <div className="mb-3">
          <label className="form-label">Naloxone Available</label>
          <select
            className="form-select"
            value={form.Naloxone_Strips}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                Naloxone_Strips: Number(e.target.value),
              }))
            }
          >
            <option value={0}>No</option>
            <option value={1}>Yes</option>
          </select>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <button className="btn btn-success w-100" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Submitting..." : "Geocode & Submit"}
        </button>
      </form>
    </div>
  );
};

export default AddLocationWidget;
