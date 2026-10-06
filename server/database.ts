import { backupState } from "../src/core/backup-state";
import { DatabaseSync } from "node:sqlite";
import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createHash,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  chmodSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { State } from "../src/core/model";
const scrypt = promisify(scryptCallback);
export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
interface User {
  id: string;
  username: string;
  password: string;
  recovery: string;
}
interface SessionRow {
  user_id: string;
  username: string;
  expires: number;
  refresh_hash: string;
}
export class AccountDatabase {
  db: DatabaseSync;
  key: Buffer;
  constructor(path: string, secret?: string) {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    }
    if (secret) {
      if (!/^[a-f0-9]{64}$/.test(secret))
        throw new Error(
          "DATA_ENCRYPTION_KEY must contain 64 hexadecimal characters.",
        );
      this.key = Buffer.from(secret, "hex");
    } else if (path === ":memory:") this.key = randomBytes(32);
    else {
      const keyPath = join(dirname(path), "encryption.key");
      if (!existsSync(keyPath))
        writeFileSync(keyPath, randomBytes(32), { mode: 0o600, flag: "wx" });
      this.key = readFileSync(keyPath);
      if (this.key.length !== 32)
        throw new Error("Invalid encryption key file.");
    }
    this.db = new DatabaseSync(path);
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;
   CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,password TEXT NOT NULL,recovery TEXT NOT NULL,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(access_hash TEXT PRIMARY KEY,refresh_hash TEXT UNIQUE NOT NULL,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL,refresh_expires INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS backups(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,revision INTEGER NOT NULL,payload TEXT NOT NULL,updated INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS provider_tokens(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,payload TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS usage(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,day));`);
  }
  hash(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }
  encrypt(value: unknown, owner: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key, iv);
    cipher.setAAD(Buffer.from(owner));
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), "utf8"),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
      "base64",
    );
  }
  decrypt<T>(text: string, owner: string): T {
    const b = Buffer.from(text, "base64");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.key,
      b.subarray(0, 12),
    );
    decipher.setAAD(Buffer.from(owner));
    decipher.setAuthTag(b.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([
        decipher.update(b.subarray(28)),
        decipher.final(),
      ]).toString(),
    );
  }
  async passwordHash(password: string) {
    if (password.length < 12 || password.length > 256)
      throw new ServiceError(400, "Password must contain 12–256 characters.");
    const salt = randomBytes(16).toString("hex");
    const hash = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${hash.toString("hex")}`;
  }
  async verify(password: string, stored: string) {
    const [salt, hash] = stored.split(":");
    const candidate = (await scrypt(password, salt, 64)) as Buffer;
    const expected = Buffer.from(hash, "hex");
    return (
      candidate.length === expected.length &&
      timingSafeEqual(candidate, expected)
    );
  }
  normalize(username: unknown) {
    if (typeof username !== "string" || !/^[a-zA-Z0-9_]{3,32}$/.test(username))
      throw new ServiceError(
        400,
        "Username must contain 3–32 letters, numbers or underscores.",
      );
    return username.toLowerCase();
  }
  issue(user: { id: string; username: string }) {
    const token = randomBytes(32).toString("hex"),
      refreshToken = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 3600000;
    this.db
      .prepare("INSERT INTO sessions VALUES(?,?,?,?,?)")
      .run(
        this.hash(token),
        this.hash(refreshToken),
        user.id,
        expiresAt,
        Date.now() + 30 * 86400000,
      );
    return {
      token,
      refreshToken,
      userId: user.id,
      username: user.username,
      expiresAt,
    };
  }
  async register(username: unknown, password: unknown) {
    const name = this.normalize(username);
    if (typeof password !== "string")
      throw new ServiceError(400, "Password is required.");
    if (this.db.prepare("SELECT id FROM users WHERE username=?").get(name))
      throw new ServiceError(409, "Username is unavailable.");
    const hash = await this.passwordHash(password);
    const id = randomBytes(16).toString("hex");
    const recoveryCode = randomBytes(24).toString("hex");
    try {
      this.db
        .prepare("INSERT INTO users VALUES(?,?,?,?,?)")
        .run(id, name, hash, this.hash(recoveryCode), Date.now());
    } catch {
      throw new ServiceError(409, "Username is unavailable.");
    }
    return { ...this.issue({ id, username: name }), recoveryCode };
  }
  async login(username: unknown, password: unknown) {
    const name = this.normalize(username);
    if (typeof password !== "string" || password.length > 256)
      throw new ServiceError(400, "Invalid password.");
    const user = this.db
      .prepare("SELECT * FROM users WHERE username=?")
      .get(name) as unknown as User | undefined;
    const dummy = "00000000000000000000000000000000:" + "0".repeat(128);
    const valid = await this.verify(password, user?.password || dummy);
    if (!user || !valid)
      throw new ServiceError(401, "Username or password is incorrect.");
    return this.issue(user);
  }
  authenticate(token: string) {
    const row = this.db
      .prepare(
        "SELECT s.user_id,u.username,s.expires FROM sessions s JOIN users u ON u.id=s.user_id WHERE access_hash=?",
      )
      .get(this.hash(token)) as unknown as SessionRow | undefined;
    if (!row || row.expires < Date.now())
      throw new ServiceError(401, "Your session has expired. Sign in again.");
    return { id: row.user_id, username: row.username };
  }
  refresh(token: string) {
    const row = this.db
      .prepare(
        "SELECT s.user_id,u.username FROM sessions s JOIN users u ON u.id=s.user_id WHERE refresh_hash=? AND refresh_expires>?",
      )
      .get(this.hash(token), Date.now()) as
      { user_id: string; username: string } | undefined;
    if (!row) throw new ServiceError(401, "Session expired. Sign in again.");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db
        .prepare("DELETE FROM sessions WHERE refresh_hash=?")
        .run(this.hash(token));
      const result = this.issue({ id: row.user_id, username: row.username });
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  logout(token: string) {
    this.db
      .prepare("DELETE FROM sessions WHERE access_hash=?")
      .run(this.hash(token));
  }
  async recover(username: unknown, recovery: unknown, password: unknown) {
    const name = this.normalize(username);
    const user = this.db
      .prepare("SELECT * FROM users WHERE username=?")
      .get(name) as unknown as User | undefined;
    if (
      typeof recovery !== "string" ||
      !user ||
      this.hash(recovery) !== user.recovery
    )
      throw new ServiceError(401, "Recovery details are incorrect.");
    if (typeof password !== "string")
      throw new ServiceError(400, "Password is required.");
    const hash = await this.passwordHash(password);
    const recoveryCode = randomBytes(24).toString("hex");
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const fresh = this.db
        .prepare("SELECT recovery FROM users WHERE id=?")
        .get(user.id) as { recovery: string } | undefined;
      if (!fresh || fresh.recovery !== this.hash(recovery))
        throw new ServiceError(401, "Recovery code was already used.");
      this.db
        .prepare("UPDATE users SET password=?,recovery=? WHERE id=?")
        .run(hash, this.hash(recoveryCode), user.id);
      this.db.prepare("DELETE FROM sessions WHERE user_id=?").run(user.id);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    return { ...this.issue(user), recoveryCode };
  }
  async remove(id: string, password: string) {
    const user = this.db
      .prepare("SELECT * FROM users WHERE id=?")
      .get(id) as unknown as User | undefined;
    if (
      password.length > 256 ||
      !user ||
      !(await this.verify(password, user.password))
    )
      throw new ServiceError(401, "Confirm your current password.");
    this.db.prepare("DELETE FROM users WHERE id=?").run(id);
  }
  readBackup(id: string) {
    const row = this.db
      .prepare("SELECT * FROM backups WHERE user_id=?")
      .get(id) as
      { revision: number; payload: string; updated: number } | undefined;
    return row
      ? {
          revision: row.revision,
          state: this.decrypt<State>(row.payload, id),
          updated: row.updated,
        }
      : { revision: 0, state: null, updated: null };
  }
  saveBackup(id: string, state: State, revision: number) {
    const current = this.readBackup(id);
    if (current.revision !== revision)
      throw new ServiceError(
        409,
        "Backup changed on another device. Restore the newer copy before uploading.",
      );
    const payload = this.encrypt(backupState(state), id);
    this.db
      .prepare(
        "INSERT INTO backups VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,payload=excluded.payload,updated=excluded.updated",
      )
      .run(id, revision + 1, payload, Date.now());
    return { revision: revision + 1, updated: Date.now() };
  }
  getProvider(id: string) {
    const row = this.db
      .prepare("SELECT payload FROM provider_tokens WHERE user_id=?")
      .get(id) as { payload: string } | undefined;
    return row
      ? this.decrypt<{ access: string; refresh: string; expires: number }>(
          row.payload,
          id,
        )
      : null;
  }
  setProvider(
    id: string,
    value: { access: string; refresh: string; expires: number } | null,
  ) {
    if (!value) {
      this.db.prepare("DELETE FROM provider_tokens WHERE user_id=?").run(id);
      return;
    }
    this.db
      .prepare(
        "INSERT INTO provider_tokens VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET payload=excluded.payload",
      )
      .run(id, this.encrypt(value, id));
  }
  useAI(id: string, limit: number) {
    const day = new Date().toISOString().slice(0, 10);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const row = this.db
        .prepare("SELECT count FROM usage WHERE user_id=? AND day=?")
        .get(id, day) as { count: number } | undefined;
      if ((row?.count || 0) >= limit)
        throw new ServiceError(
          429,
          "Daily AI allowance reached. Try again tomorrow.",
        );
      this.db
        .prepare(
          "INSERT INTO usage VALUES(?,?,1) ON CONFLICT(user_id,day) DO UPDATE SET count=count+1",
        )
        .run(id, day);
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  close() {
    this.db.close();
  }
}
