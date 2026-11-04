import { useEffect, useState } from "react";
import { AdminSidebar } from "./Dashboard.jsx";
import Loader from "../../components/Loader.jsx";
import ObjectUrlImage from "../../components/ObjectUrlImage.jsx";
import OptionsEditor from "../../components/OptionsEditor.jsx";
import { msg } from "../../utils/messages.js";
import {
  adminGetCustomOrderCategories,
  adminCreateCustomOrderCategory,
  adminUpdateCustomOrderCategory,
  adminDeleteCustomOrderCategory,
  adminGetProductReferences,
  adminCreateProductReference,
  adminDeleteProductReference,
  adminGetExistingImages,
} from "../../services/api.js";

// ── Normalize legacy choices (plain strings → {label,value}) ──────────────────

function normalizeOptions(opts) {
  if (!Array.isArray(opts)) return [];
  return opts.map((o) => ({
    name: o.name || o.nameFr || o.nameEn || "",
    nameFr: o.nameFr || o.name || "",
    nameEn: o.nameEn || "",
    choices: (o.choices || []).map((c) =>
      typeof c === "string"
        ? { label: c, value: c }
        : { label: c.label || "", value: c.value || "" },
    ),
  }));
}

// ── Reference photos ─────────────────────────────────────────────────────────

function ReferencePhotos({
  categoryName,
  pendingPhotos,
  onPendingChange,
}) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [existingImages, setExistingImages] = useState([]);

  const isNew = !categoryName;

  async function loadPhotos() {
    if (!categoryName) return;
    setLoading(true);
    try {
      const data = await adminGetProductReferences(categoryName);
      setPhotos(Array.isArray(data) ? data : []);
    } catch {
      setPhotos([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (categoryName) loadPhotos();
  }, [categoryName]);

  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (isNew) {
      // Queue file for after save
      onPendingChange([...pendingPhotos, { type: "file", file }]);
      e.target.value = "";
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", `ref-${Date.now()}`);
      fd.append("category", categoryName);
      fd.append("image", file);
      await adminCreateProductReference(fd);
      await loadPhotos();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handlePickExisting() {
    if (showPicker) {
      setShowPicker(false);
      return;
    }
    try {
      const data = await adminGetExistingImages();
      setExistingImages(Array.isArray(data) ? data : []);
    } catch {
      setExistingImages([]);
    }
    setShowPicker(true);
  }

  async function handleSelectExisting(url) {
    if (isNew) {
      onPendingChange([...pendingPhotos, { type: "url", url }]);
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("name", `ref-${Date.now()}`);
      fd.append("category", categoryName);
      fd.append("existingImageUrl", url);
      await adminCreateProductReference(fd);
      await loadPhotos();
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id) {
    try {
      await adminDeleteProductReference(id);
      setPhotos((p) => p.filter((r) => r.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function handleRemovePending(idx) {
    onPendingChange(pendingPhotos.filter((_, i) => i !== idx));
  }

  return (
    <div>
      {loading && (
        <div style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
          Chargement...
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
          gap: "0.5rem",
          marginBottom: "0.5rem",
        }}
      >
        {photos.map((p) => (
          <div
            key={p.id}
            style={{
              position: "relative",
              aspectRatio: "1",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
            }}
          >
            <img
              src={p.imageUrl}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
              }}
            />
            <button
              type="button"
              onClick={() => handleDelete(p.id)}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: "rgba(0,0,0,0.6)",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: 22,
                height: 22,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
        {pendingPhotos.map((p, i) => (
          <div
            key={`pending-${i}`}
            style={{
              position: "relative",
              aspectRatio: "1",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
            }}
          >
            <ObjectUrlImage
              src={p.type === "url" ? p.url : undefined}
              file={p.type === "file" ? p.file : undefined}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                opacity: 0.7,
              }}
            />
            <button
              type="button"
              onClick={() => handleRemovePending(i)}
              style={{
                position: "absolute",
                top: 4,
                right: 4,
                background: "rgba(0,0,0,0.6)",
                color: "white",
                border: "none",
                borderRadius: "50%",
                width: 22,
                height: 22,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "0.75rem",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <label
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.35rem 0.75rem",
            fontSize: "0.8rem",
            border: "1px dashed var(--color-border)",
            borderRadius: "var(--radius-sm)",
            cursor: uploading ? "wait" : "pointer",
            color: "var(--color-text-muted)",
          }}
        >
          {uploading ? "Envoi..." : "+ Ajouter une photo"}
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>

        <button
          type="button"
          onClick={handlePickExisting}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.35rem 0.75rem",
            fontSize: "0.8rem",
            border: `1px ${showPicker ? "solid" : "dashed"} var(--color-border)`,
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            color: showPicker
              ? "var(--color-primary)"
              : "var(--color-text-muted)",
            background: showPicker ? "var(--color-bg-alt)" : "transparent",
          }}
        >
          Choisir une existante
        </button>
      </div>

      {showPicker && (
        <div
          style={{
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius)",
            padding: "0.75rem",
            maxHeight: 200,
            overflowY: "auto",
            background: "var(--color-bg-alt)",
            marginTop: "0.5rem",
          }}
        >
          {existingImages.length === 0 ? (
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "0.8rem",
                margin: 0,
                textAlign: "center",
              }}
            >
              Aucune image disponible
            </p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))",
                gap: "0.5rem",
              }}
            >
              {existingImages.map((img, i) => (
                <div
                  key={i}
                  onClick={() => handleSelectExisting(img.url)}
                  title={img.label}
                  style={{
                    cursor: "pointer",
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                    aspectRatio: "1",
                    border: "2px solid transparent",
                    transition: "border-color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.borderColor = "var(--color-primary)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.borderColor = "transparent")
                  }
                >
                  <img
                    src={img.url}
                    alt={img.label}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

const EMPTY_FORM = {
  name: "",
  nameFr: "",
  nameEn: "",
  icon: "",
  options: [],
  isActive: true,
  displayOrder: 0,
};

function CategoryModal({ category, onClose, onSave }) {
  const [form, setForm] = useState(
    category
      ? {
          name: category.name || "",
          nameFr: category.nameFr || category.name || "",
          nameEn: category.nameEn || "",
          icon: category.icon || "",
          options: normalizeOptions(category.options),
          isActive: category.isActive !== false,
          displayOrder: category.displayOrder ?? 0,
        }
      : { ...EMPTY_FORM },
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [pendingPhotos, setPendingPhotos] = useState([]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.nameFr.trim()) e.nameFr = "Le nom français est requis";
    if (!form.nameEn.trim()) e.nameEn = "Le nom anglais est requis";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    setApiError(null);
    try {
      const nameFr = form.nameFr.trim();
      const nameEn = form.nameEn.trim();
      const name = nameFr || nameEn;
      await onSave({
        name,
        nameFr,
        nameEn,
        code: name
          .toUpperCase()
          .replace(/[^A-Z0-9]+/g, "_")
          .replace(/^_|_$/g, ""),
        icon: form.icon.trim() || null,
        options: form.options
          .map((o) => {
            const nameFr = (o.nameFr || o.name || "").trim();
            const nameEn = (o.nameEn || "").trim();
            return {
              ...o,
              name: nameFr || nameEn,
              nameFr,
              nameEn,
              choices: Array.isArray(o.choices) ? o.choices : [],
            };
          })
          .filter((o) => o.nameFr || o.nameEn),
        isActive: form.isActive,
        displayOrder: Number(form.displayOrder) || 0,
      });
      // Create pending photos after category is saved
      for (const p of pendingPhotos) {
        const fd = new FormData();
        fd.append("name", `ref-${Date.now()}`);
        fd.append("category", name);
        if (p.type === "file") {
          fd.append("image", p.file);
        } else {
          fd.append("existingImageUrl", p.url);
        }
        await adminCreateProductReference(fd);
      }
      onClose();
    } catch (err) {
      setApiError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 660 }}>
        <div className="modal-header">
          <span className="modal-title">
            {category ? "Modifier la catégorie" : "Nouvel item"}
          </span>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          {apiError && <div className="alert alert-error">{apiError}</div>}

          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label className="form-label">Nom français <span className="required-mark">*</span></label>
              <input
                type="text"
                className={`form-input${errors.nameFr ? " error" : ""}`}
                value={form.nameFr}
                onChange={(e) => set("nameFr", e.target.value)}
                placeholder="ex: Cardigan, Pull…"
              />
              {errors.nameFr && <p className="form-error">{errors.nameFr}</p>}
            </div>
            <div className="form-group" style={{ flex: 3 }}>
              <label className="form-label">Nom anglais <span className="required-mark">*</span></label>
              <input
                type="text"
                className={`form-input${errors.nameEn ? " error" : ""}`}
                value={form.nameEn}
                onChange={(e) => set("nameEn", e.target.value)}
                placeholder="ex: Cardigan, Sweater…"
              />
              {errors.nameEn && <p className="form-error">{errors.nameEn}</p>}
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label className="form-label">Icône</label>
              <input
                type="text"
                className="form-input"
                value={form.icon}
                onChange={(e) => set("icon", e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Backspace" && form.icon) {
                    e.preventDefault();
                    e.target.value = "";
                    set("icon", "");
                    const evt = new Event("input", { bubbles: true });
                    e.target.dispatchEvent(evt);
                  }
                }}
                placeholder=""
              />
            </div>
          </div>

          <div className="form-group" style={{ maxWidth: 100 }}>
            <label className="form-label">Ordre</label>
            <input
              type="number"
              min="0"
              className="form-input"
              value={form.displayOrder}
              onChange={(e) => set("displayOrder", e.target.value)}
            />
          </div>

          <div className="form-group" style={{ marginBottom: "0.75rem" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
              />
              Active (visible côté client)
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">Options</label>
            <OptionsEditor
              options={form.options}
              onChange={(o) => set("options", o)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Photos de référence</label>
            <ReferencePhotos
              categoryName={category?.name || null}
              pendingPhotos={pendingPhotos}
              onPendingChange={setPendingPhotos}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? "Sauvegarde..." : "Sauvegarder"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page principale ───────────────────────────────────────────────────────────

export default function AdminCustomOrderCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [modalCat, setModalCat] = useState(undefined);
  const [confirmDelete, setConfirmDelete] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const data = await adminGetCustomOrderCategories();
      setCategories(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleSave(payload) {
    if (modalCat?.id) {
      await adminUpdateCustomOrderCategory(modalCat.id, payload);
    } else {
      await adminCreateCustomOrderCategory(payload);
    }
    await load();
  }

  async function handleDelete(id) {
    try {
      await adminDeleteCustomOrderCategory(id);
      setConfirmDelete(null);
      await load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <main className="admin-main">
        <div className="admin-header">
          <h1>Sur mesure</h1>
          <button className="btn btn-primary" onClick={() => setModalCat(null)}>
            + Nouvel item
          </button>
        </div>

        {loading && <Loader label="Chargement..." />}
        {error && <div className="alert alert-error">{error}</div>}

        {!loading && !error && (
          <>
            <div className="table-container admin-mobile-replaced-table">
              <table>
                <thead>
                  <tr>
                    <th>Icône</th>
                    <th>Nom</th>
                    <th>Options</th>
                    <th>Statut</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: "2rem", color: "var(--color-text-muted)" }}>
                        Aucune catégorie
                      </td>
                    </tr>
                  ) : (
                    categories.map((c) => (
                      <tr key={c.id}>
                        <td data-label="Icône" style={{ fontSize: "1.5rem", textAlign: "center" }}>
                          {c.icon || "—"}
                        </td>
                    <td data-label="Nom" style={{ fontWeight: 600 }}>
                      {c.nameFr || c.name}
                      {c.nameEn && (
                        <div style={{ fontSize: "0.78rem", color: "var(--color-text-muted)", fontWeight: 500 }}>
                          EN: {c.nameEn}
                        </div>
                      )}
                    </td>
                        <td data-label="Options" style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                          {c.options?.length > 0
                            ? c.options.map((o) => `${o.name} (${o.choices?.length || 0})`).join(", ")
                            : "—"}
                        </td>
                        <td data-label="Statut">
                          {c.isActive ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}
                        </td>
                        <td data-label="Actions">
                          <div style={{ display: "flex", gap: "0.375rem" }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => setModalCat(c)}>Modifier</button>
                            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(c)}>Supprimer</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="admin-compact-mobile-list">
              {categories.length === 0 ? (
                <div className="admin-compact-mobile-empty">Aucune catégorie</div>
              ) : categories.map((c) => (
                <article className="admin-compact-mobile-card" key={c.id}>
                  <div className="admin-compact-mobile-top">
                    <div className="admin-compact-mobile-title">
                        <h2>{c.icon ? `${c.icon} ` : ''}{c.nameFr || c.name}</h2>
                        {c.nameEn && <p>EN: {c.nameEn}</p>}
                        <p>{c.options?.length || 0} option(s)</p>
                    </div>
                    <div className="admin-compact-mobile-badges">
                      {c.isActive ? <span className="badge badge-green">Active</span> : <span className="badge badge-red">Inactive</span>}
                    </div>
                  </div>
                  <div className="admin-compact-mobile-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => setModalCat(c)}>Modifier</button>
                    <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(c)}>Supprimer</button>
                  </div>
                </article>
              ))}
            </div>
          </>
        )}

        {modalCat !== undefined && (
          <CategoryModal
            category={modalCat}
            onClose={() => setModalCat(undefined)}
            onSave={handleSave}
          />
        )}

        {confirmDelete && (
          <div
            className="modal-overlay"
            onClick={(e) =>
              e.target === e.currentTarget && setConfirmDelete(null)
            }
          >
            <div className="modal" style={{ maxWidth: 400 }}>
              <div className="modal-header">
                <span className="modal-title">Confirmer la suppression</span>
                <button
                  className="modal-close"
                  onClick={() => setConfirmDelete(null)}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>
                  Supprimer <strong>{confirmDelete.name}</strong> ?
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setConfirmDelete(null)}
                >
                  Annuler
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => handleDelete(confirmDelete.id)}
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
