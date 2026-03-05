import test from "node:test";
import assert from "node:assert/strict";
import {
  mapHeaders,
  normalizeEmail,
  slugifyProduct,
  friendlyProductName,
  detectSourceType,
  isEntitledStatus
} from "../dist/utils/autodesk.js";

test("mapHeaders matches common synonyms", () => {
  const headers = ["User Email", "Product Name", "Team", "Status", "Last Used Date"];
  const map = mapHeaders(headers);
  assert.equal(map.email, "User Email");
  assert.equal(map.product, "Product Name");
  assert.equal(map.team, "Team");
  assert.equal(map.status, "Status");
  assert.equal(map.lastUsed, "Last Used Date");
});

test("normalizeEmail lowercases and trims", () => {
  assert.equal(normalizeEmail("  USER@MTCC.COM.MV "), "user@mtcc.com.mv");
});

test("slugifyProduct removes spaces and punctuation", () => {
  assert.equal(slugifyProduct("Civil 3D"), "civil3d");
  assert.equal(slugifyProduct("Navisworks Manage"), "navisworksmanage");
});

test("friendlyProductName maps known products", () => {
  assert.equal(friendlyProductName("AutoCAD"), "AutoCAD");
  assert.equal(friendlyProductName("3ds Max"), "3ds Max");
  assert.equal(friendlyProductName("Unknown App"), "Unknown App");
});

test("detectSourceType identifies usage report vs seat usage", () => {
  assert.equal(detectSourceType(["Last Used", "User Email"]), "usage_report");
  assert.equal(detectSourceType(["Assignment", "User"]), "seat_usage");
  assert.equal(detectSourceType(["Something"]), "unknown");
});

test("isEntitledStatus handles positive and negative statuses", () => {
  assert.equal(isEntitledStatus("Assigned"), true);
  assert.equal(isEntitledStatus("Active"), true);
  assert.equal(isEntitledStatus("Enabled"), true);
  assert.equal(isEntitledStatus("Revoked"), false);
  assert.equal(isEntitledStatus("Expired"), false);
  assert.equal(isEntitledStatus(undefined), true);
});
