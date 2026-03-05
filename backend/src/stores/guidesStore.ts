import fs from "fs";
import path from "path";

export type GuideStepInput = {
  id?: string;
  title: string;
  content: string;
  imageUrl?: string;
};

export type GuideStep = {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
};

export type GuideType = "step" | "knowledge" | "video";

export type Guide = {
  id: number;
  title: string;
  subtitle?: string;
  description?: string;
  type: GuideType;
  body?: string;
  videoUrl?: string;
  steps: GuideStep[];
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

type GuideInput = {
  title: string;
  subtitle?: string;
  description?: string;
  type: GuideType;
  body?: string;
  videoUrl?: string;
  steps?: GuideStepInput[];
  published?: boolean;
};

const GUIDE_STORE_PATH = "/uploads/guides.json";

type GuideStoreFile = {
  nextId: number;
  guides: Guide[];
};

const defaultGuides: Guide[] = [
  {
    id: 1,
    title: "How to Recall an Email in Outlook",
    subtitle: "Undo a sent message in Outlook Web",
    description: "Follow these quick steps to recall a message from Outlook Web.",
    type: "step",
    steps: [
      { id: "step-1", title: "Login to Outlook Web", content: "Sign in to Outlook on the web using your MTCC account." },
      { id: "step-2", title: "Go to Sent Items", content: "Open the Sent Items folder from the left navigation." },
      { id: "step-3", title: "Open the email to recall", content: "Click the sent message you want to recall." },
      {
        id: "step-4",
        title: "Use the 3 dots → Advanced actions → Recall Message",
        content: "Open More actions (⋯), choose Advanced actions, then Recall Message."
      },
      { id: "step-5", title: "Confirm the recall prompt", content: "Confirm the recall request to finish." }
    ],
    published: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

function loadStore(): GuideStoreFile {
  try {
    fs.mkdirSync(path.dirname(GUIDE_STORE_PATH), { recursive: true });
    if (fs.existsSync(GUIDE_STORE_PATH)) {
      const raw = fs.readFileSync(GUIDE_STORE_PATH, "utf-8");
      const parsed = JSON.parse(raw) as GuideStoreFile;
      if (parsed && Array.isArray(parsed.guides) && typeof parsed.nextId === "number") {
        return parsed;
      }
    }
    const seed: GuideStoreFile = { nextId: 2, guides: defaultGuides };
    fs.writeFileSync(GUIDE_STORE_PATH, JSON.stringify(seed, null, 2));
    return seed;
  } catch {
    // fall back to defaults
  }
  return { nextId: 2, guides: defaultGuides };
}

function saveStore(): void {
  const payload: GuideStoreFile = { nextId, guides };
  fs.mkdirSync(path.dirname(GUIDE_STORE_PATH), { recursive: true });
  fs.writeFileSync(GUIDE_STORE_PATH, JSON.stringify(payload, null, 2));
}

const loaded = loadStore();
let nextId = loaded.nextId;
const guides: Guide[] = loaded.guides;

function normalizeSteps(steps: GuideStepInput[]): GuideStep[] {
  return steps.map((step, index) => ({
    id: step.id || `step-${Date.now()}-${index}`,
    title: step.title.trim(),
    content: step.content.trim(),
    imageUrl: step.imageUrl?.trim() || undefined
  }));
}

export function listGuides(): Guide[] {
  return [...guides];
}

export function listPublishedGuides(): Guide[] {
  return guides.filter((guide) => guide.published);
}

export function getGuide(id: number): Guide | undefined {
  return guides.find((guide) => guide.id === id);
}

export function createGuide(input: GuideInput): Guide {
  const now = new Date().toISOString();
  const guide: Guide = {
    id: nextId++,
    title: input.title.trim(),
    subtitle: input.subtitle?.trim() || undefined,
    description: input.description?.trim() || undefined,
    type: input.type,
    body: input.body?.trim() || undefined,
    videoUrl: input.videoUrl?.trim() || undefined,
    steps: normalizeSteps(input.steps || []),
    published: input.published ?? false,
    createdAt: now,
    updatedAt: now
  };
  guides.unshift(guide);
  saveStore();
  return guide;
}

export function updateGuide(id: number, input: GuideInput): Guide | undefined {
  const guide = guides.find((item) => item.id === id);
  if (!guide) return undefined;
  guide.title = input.title.trim();
  guide.subtitle = input.subtitle?.trim() || undefined;
  guide.description = input.description?.trim() || undefined;
  guide.type = input.type;
  guide.body = input.body?.trim() || undefined;
  guide.videoUrl = input.videoUrl?.trim() || undefined;
  guide.steps = normalizeSteps(input.steps || []);
  guide.published = input.published ?? guide.published;
  guide.updatedAt = new Date().toISOString();
  saveStore();
  return guide;
}

export function deleteGuide(id: number): boolean {
  const index = guides.findIndex((guide) => guide.id === id);
  if (index === -1) return false;
  guides.splice(index, 1);
  saveStore();
  return true;
}
