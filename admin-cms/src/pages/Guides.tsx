import { useEffect, useMemo, useRef, useState } from "react";
import api from "../api";
import useAdminAuth from "../hooks/useAdminAuth";

type GuideStep = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
};

type GuideType = "step" | "knowledge" | "video";

type Guide = {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  type: GuideType;
  body?: string;
  videoUrl?: string;
  steps: GuideStep[];
  published: boolean;
};

type GuideComment = {
  id: string;
  guide_id: string;
  guide_title: string;
  user_name: string;
  user_email: string;
  rating: number;
  comment: string;
  created_at: string;
};

const emptyStep = (): GuideStep => ({
  id: `step-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  title: "",
  content: "",
  imageUrl: ""
});

export default function Guides() {
  const { user } = useAdminAuth();
  const [guides, setGuides] = useState<Guide[]>([]);
  const [comments, setComments] = useState<GuideComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [form, setForm] = useState<Guide>({
    id: 0,
    title: "",
    subtitle: "",
    description: "",
    type: "step",
    body: "",
    videoUrl: "",
    steps: [emptyStep()],
    published: false
  });
  const [uploadingStep, setUploadingStep] = useState<number | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const load = () => {
    api
      .get("/admin/guides")
      .then((res) => setGuides(Array.isArray(res.data.guides) ? res.data.guides : []))
      .catch(() => setGuides([]));
  };

  const loadComments = () => {
    if (user?.role !== "superadmin") return;
    setCommentsLoading(true);
    api
      .get("/admin/guides/ratings")
      .then((res) => setComments(Array.isArray(res.data.comments) ? res.data.comments : []))
      .catch(() => setComments([]))
      .finally(() => setCommentsLoading(false));
  };

  useEffect(() => {
    load();
    loadComments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const sanitizedBody = form.type === "knowledge" ? sanitizeHtml(form.body || "") : form.body;
    const payload = {
      title: form.title,
      subtitle: form.subtitle,
      description: form.description,
      type: form.type,
      body: sanitizedBody,
      videoUrl: form.videoUrl,
      steps: form.type === "step" ? form.steps : [],
      published: form.published
    };
    if (form.id) {
      await api.put(`/admin/guides/${form.id}`, payload);
    } else {
      await api.post("/admin/guides", payload);
    }
    setForm({
      id: 0,
      title: "",
      subtitle: "",
      description: "",
      type: "step",
      body: "",
      videoUrl: "",
      steps: [emptyStep()],
      published: false
    });
    load();
  };

  const handleEdit = (guide: Guide) => {
    setForm({
      id: guide.id,
      title: guide.title,
      subtitle: guide.subtitle || "",
      description: guide.description || "",
      type: guide.type || "step",
      body: guide.body || "",
      videoUrl: guide.videoUrl || "",
      steps: guide.steps.length ? guide.steps : [emptyStep()],
      published: guide.published
    });
  };

  const handleDelete = async (id: number) => {
    await api.delete(`/admin/guides/${id}`);
    load();
  };

  const handleTogglePublished = async (guide: Guide) => {
    await api.put(`/admin/guides/${guide.id}`, {
      title: guide.title,
      subtitle: guide.subtitle,
      description: guide.description,
      type: guide.type,
      body: guide.body,
      videoUrl: guide.videoUrl,
      steps: guide.type === "step" ? guide.steps : [],
      published: !guide.published
    });
    load();
  };

  const updateStep = (index: number, updates: Partial<GuideStep>) => {
    setForm((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], ...updates };
      return { ...prev, steps };
    });
  };

  const addStep = () => {
    setForm((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }));
  };

  const removeStep = (index: number) => {
    setForm((prev) => {
      const steps = prev.steps.filter((_step, idx) => idx !== index);
      return { ...prev, steps: steps.length ? steps : [emptyStep()] };
    });
  };

  const handleImageUpload = async (index: number, file?: File | null) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setUploadingStep(index);
    try {
      const res = await api.post("/admin/guides/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      updateStep(index, { imageUrl: res.data?.url || "" });
    } catch {
      updateStep(index, { imageUrl: "" });
    } finally {
      setUploadingStep(null);
    }
  };

  const guideLabel = (guide: Guide) => {
    if (guide.type === "knowledge") return "Knowledge Base";
    if (guide.type === "video") return "Video Guide";
    return `${guide.steps.length} steps`;
  };

  const editorHtml = useMemo(() => form.body || "", [form.body]);

  const updateEditorHtml = (value: string) => {
    setForm((prev) => ({ ...prev, body: value }));
  };

  const applyCommand = (command: string, value?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (command === "createLink") {
      const url = value || window.prompt("Enter link URL");
      if (url) document.execCommand(command, false, url);
      return;
    }
    if (command === "insertImage") {
      const url = value || window.prompt("Enter image URL");
      if (url) document.execCommand(command, false, url);
      return;
    }
    if (command === "formatBlock" && value) {
      document.execCommand(command, false, value);
      return;
    }
    if (command === "insertTable") {
      const rows = Math.max(1, Number(window.prompt("Rows", "2") || 2));
      const cols = Math.max(1, Number(window.prompt("Columns", "2") || 2));
      const cells = Array.from({ length: rows })
        .map(
          () =>
            `<tr>${Array.from({ length: cols }).map(() => "<td>&nbsp;</td>").join("")}</tr>`
        )
        .join("");
      document.execCommand(
        "insertHTML",
        false,
        `<table><tbody>${cells}</tbody></table>`
      );
      return;
    }
    document.execCommand(command, false, value);
  };

  return (
    <section className="card">
      <h1>Guides</h1>
      <form className="form" onSubmit={handleSubmit}>
        <input
          placeholder="Guide title"
          value={form.title}
          onChange={(event) => setForm({ ...form, title: event.target.value })}
        />
        <input
          placeholder="Subtitle (optional)"
          value={form.subtitle || ""}
          onChange={(event) => setForm({ ...form, subtitle: event.target.value })}
        />
        <input
          placeholder="Short description (optional)"
          value={form.description || ""}
          onChange={(event) => setForm({ ...form, description: event.target.value })}
        />
        <select
          value={form.type}
          onChange={(event) =>
            setForm((prev) => ({
              ...prev,
              type: event.target.value as GuideType,
              steps: prev.steps.length ? prev.steps : [emptyStep()]
            }))
          }
        >
          <option value="step">Step by Step Guide</option>
          <option value="knowledge">Knowledge Base</option>
          <option value="video">Embedded Video Guide</option>
        </select>
        {form.type === "knowledge" && (
          <div className="wysiwyg">
            <div className="wysiwyg-toolbar">
              <button type="button" className="btn ghost" onClick={() => applyCommand("undo")}>
                Undo
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("redo")}>
                Redo
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("bold")}>
                Bold
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("italic")}>
                Italic
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("underline")}>
                Underline
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("formatBlock", "h1")}>
                H1
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("formatBlock", "h2")}>
                H2
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("formatBlock", "blockquote")}>
                Quote
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("formatBlock", "pre")}>
                Code
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("insertUnorderedList")}>
                Bullets
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("insertOrderedList")}>
                Numbers
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("justifyLeft")}>
                Left
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("justifyCenter")}>
                Center
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("justifyRight")}>
                Right
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const color = window.prompt("Text color (hex or name)", "#0d2445");
                  if (color) applyCommand("foreColor", color);
                }}
              >
                Text Color
              </button>
              <button
                type="button"
                className="btn ghost"
                onClick={() => {
                  const color = window.prompt("Background color (hex or name)", "#f5f7fb");
                  if (color) applyCommand("hiliteColor", color);
                }}
              >
                Bg Color
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("createLink")}>
                Link
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("insertImage")}>
                Image
              </button>
              <button type="button" className="btn ghost" onClick={() => applyCommand("insertTable")}>
                Table
              </button>
            </div>
            <div
              ref={editorRef}
              className="wysiwyg-editor"
              contentEditable
              suppressContentEditableWarning
              onInput={(event) => updateEditorHtml((event.target as HTMLDivElement).innerHTML)}
              dangerouslySetInnerHTML={{ __html: editorHtml }}
            />
          </div>
        )}
        {form.type === "video" && (
          <input
            placeholder="Video embed URL (iframe src)"
            value={form.videoUrl || ""}
            onChange={(event) => setForm({ ...form, videoUrl: event.target.value })}
          />
        )}
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={form.published}
            onChange={(event) => setForm({ ...form, published: event.target.checked })}
          />
          Published
        </label>
        {form.type === "step" && (
          <div className="form-steps">
            {form.steps.map((step, index) => (
              <div key={step.id} className="form-step">
                <div className="step-head">
                  <strong>Step {index + 1}</strong>
                  <button type="button" className="btn ghost" onClick={() => removeStep(index)}>
                    Remove
                  </button>
                </div>
                <input
                  placeholder="Step title"
                  value={step.title}
                  onChange={(event) => updateStep(index, { title: event.target.value })}
                />
                <textarea
                  placeholder="Step content"
                  rows={3}
                  value={step.content}
                  onChange={(event) => updateStep(index, { content: event.target.value })}
                />
                <div className="guide-upload">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => handleImageUpload(index, event.target.files?.[0])}
                  />
                  {uploadingStep === index && <span className="muted">Uploading...</span>}
                </div>
                <input
                  placeholder="Image URL (optional)"
                  value={step.imageUrl || ""}
                  onChange={(event) => updateStep(index, { imageUrl: event.target.value })}
                />
                {step.imageUrl && (
                  <img className="guide-preview" src={step.imageUrl} alt={step.title || "Step image"} />
                )}
              </div>
            ))}
            <button type="button" className="btn ghost" onClick={addStep}>
              Add Step
            </button>
          </div>
        )}
        <button className="btn" type="submit">
          {form.id ? "Update Guide" : "Create Guide"}
        </button>
      </form>

      <div className="list">
        {guides.map((guide) => (
          <div key={guide.id} className="list-item">
            <div>
              <h3>{guide.title}</h3>
              <p>{guideLabel(guide)} • {guide.published ? "Published" : "Draft"}</p>
            </div>
            <div className="actions">
              <button className="btn ghost" onClick={() => handleEdit(guide)}>Edit</button>
              <button className="btn ghost" onClick={() => handleTogglePublished(guide)}>
                {guide.published ? "Unpublish" : "Publish"}
              </button>
              <button className="btn ghost" onClick={() => handleDelete(guide.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {user?.role === "superadmin" && (
        <section className="panel">
          <h2>Guide Feedback</h2>
          <p className="muted">Recent comments from users. Ratings remain even if comments are removed.</p>
          {commentsLoading ? (
            <div className="panel">Loading comments...</div>
          ) : comments.length === 0 ? (
            <div className="panel">No comments yet.</div>
          ) : (
            <div className="table-list">
              {comments.map((comment) => (
                <div key={comment.id} className="table-row">
                  <div className="table-cell">
                    <div className="row-title">{comment.guide_title}</div>
                    <div className="muted">
                      {comment.user_name} · {comment.user_email} · {comment.rating}/5
                    </div>
                    <div className="row-sub">{comment.comment}</div>
                  </div>
                  <div className="table-cell row-actions">
                    <button
                      className="btn ghost"
                      onClick={async () => {
                        await api.delete(`/admin/guides/ratings/${comment.id}/comment`);
                        loadComments();
                      }}
                    >
                      Delete Comment
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </section>
  );
}

function sanitizeHtml(input: string): string {
  if (!input) return "";
  const parser = new DOMParser();
  const doc = parser.parseFromString(input, "text/html");
  const blockedTags = ["script", "style", "iframe", "object", "embed"];
  blockedTags.forEach((tag) => doc.querySelectorAll(tag).forEach((node) => node.remove()));
  doc.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (name.startsWith("on")) {
        node.removeAttribute(attr.name);
      }
      if (name === "style") {
        const allowed = attr.value
          .split(";")
          .map((item) => item.trim())
          .filter((item) => {
            const [prop] = item.split(":");
            const key = prop?.trim().toLowerCase();
            return key === "color" || key === "background-color" || key === "text-align";
          })
          .join("; ");
        if (allowed) {
          node.setAttribute("style", allowed);
        } else {
          node.removeAttribute("style");
        }
      }
      if (name === "href" && (node as HTMLAnchorElement).href?.startsWith("javascript:")) {
        node.removeAttribute(attr.name);
      }
    });
  });
  return doc.body.innerHTML;
}
