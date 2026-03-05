import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptPayload, decryptPayload } from "../dist/utils/cryptoPayload.js";

const key = Buffer.alloc(32, 7);

test("encrypt/decrypt roundtrip with AAD", () => {
  const payload = { email: "user@example.com", name: "User" };
  const bundle = encryptPayload(payload, key, "v1", ["handshake", "origin", "auth/me"]);
  const decrypted = decryptPayload(bundle, key, ["handshake", "origin", "auth/me"]);
  assert.equal(decrypted.email, payload.email);
  assert.equal(decrypted.name, payload.name);
});

test("wrong tag fails", () => {
  const payload = { a: 1 };
  const bundle = encryptPayload(payload, key, "v1", ["handshake", "origin", "auth/me"]);
  const bad = { ...bundle, tag: Buffer.alloc(16, 1).toString("base64") };
  assert.throws(() => decryptPayload(bad, key, ["handshake", "origin", "auth/me"]));
});

test("wrong iv fails", () => {
  const payload = { a: 1 };
  const bundle = encryptPayload(payload, key, "v1", ["handshake", "origin", "auth/me"]);
  const bad = { ...bundle, iv: Buffer.alloc(12, 2).toString("base64") };
  assert.throws(() => decryptPayload(bad, key, ["handshake", "origin", "auth/me"]));
});

test("wrong aad fails", () => {
  const payload = { a: 1 };
  const bundle = encryptPayload(payload, key, "v1", ["handshake", "origin", "auth/me"]);
  assert.throws(() => decryptPayload(bundle, key, ["wrong", "origin", "auth/me"]));
});
