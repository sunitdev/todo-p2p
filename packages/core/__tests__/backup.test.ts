import { describe, expect, test } from "bun:test";
import { encryptBackup, decryptBackup, BackupError } from "../src/backup.ts";
import { TodoStore } from "../src/todoStore.ts";

function sampleSnapshot(): Uint8Array {
  const store = TodoStore.create();
  store.add({ id: "a", title: "Buy milk" });
  store.addArea({ id: "work", name: "Work", color: "tint" });
  return store.save();
}

describe("backup codec", () => {
  test("encrypt → decrypt round-trips the snapshot", async () => {
    const snap = sampleSnapshot();
    const file = await encryptBackup(snap, "correct horse battery staple");
    const out = await decryptBackup(file, "correct horse battery staple");
    expect(out).toEqual(snap);
    // Restored bytes load back into a working store.
    expect(TodoStore.load(out).get("a")?.title).toBe("Buy milk");
  });

  test("ciphertext is not the plaintext (snapshot is actually sealed)", async () => {
    const snap = sampleSnapshot();
    const file = await encryptBackup(snap, "pw");
    // The plaintext "Buy milk" must not appear anywhere in the sealed bytes.
    const needle = new TextEncoder().encode("Buy milk");
    expect(indexOf(file, needle)).toBe(-1);
  });

  test("two encryptions of the same input differ (random salt + iv)", async () => {
    const snap = sampleSnapshot();
    const a = await encryptBackup(snap, "pw");
    const b = await encryptBackup(snap, "pw");
    expect(a).not.toEqual(b);
  });

  test("wrong passphrase throws BackupError", async () => {
    const file = await encryptBackup(sampleSnapshot(), "right");
    await expect(decryptBackup(file, "wrong")).rejects.toBeInstanceOf(BackupError);
  });

  test("a tampered byte fails the auth tag", async () => {
    const file = await encryptBackup(sampleSnapshot(), "pw");
    const last = file.length - 1;
    file[last] = (file[last] ?? 0) ^ 0xff;
    await expect(decryptBackup(file, "pw")).rejects.toBeInstanceOf(BackupError);
  });

  test("non-backup bytes are rejected by magic check", async () => {
    const junk = new Uint8Array(64);
    await expect(decryptBackup(junk, "pw")).rejects.toThrow(/not a todo-p2p backup/);
  });

  test("truncated file is rejected", async () => {
    await expect(decryptBackup(new Uint8Array(3), "pw")).rejects.toThrow(/truncated/);
  });

  test("unsupported version is rejected", async () => {
    const file = await encryptBackup(sampleSnapshot(), "pw");
    file[8] = 99; // version byte sits right after the 8-byte magic
    await expect(decryptBackup(file, "pw")).rejects.toThrow(/unsupported backup version/);
  });

  test("empty passphrase is refused on encrypt", async () => {
    await expect(encryptBackup(sampleSnapshot(), "")).rejects.toBeInstanceOf(BackupError);
  });
});

function indexOf(haystack: Uint8Array, needle: Uint8Array): number {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
}
