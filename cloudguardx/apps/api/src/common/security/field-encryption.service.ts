import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Environment } from "../../config/env.schema";

interface EncryptedFieldEnvelope {
  v: 1;
  alg: "aes-256-gcm";
  iv: string;
  tag: string;
  ciphertext: string;
}

@Injectable()
export class FieldEncryptionService {
  constructor(private readonly configService: ConfigService<Environment, true>) {}

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.key(), iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const envelope: EncryptedFieldEnvelope = {
      v: 1,
      alg: "aes-256-gcm",
      iv: iv.toString("base64url"),
      tag: cipher.getAuthTag().toString("base64url"),
      ciphertext: ciphertext.toString("base64url")
    };

    return JSON.stringify(envelope);
  }

  decrypt(encryptedValue: string): string {
    const envelope = JSON.parse(encryptedValue) as EncryptedFieldEnvelope;
    const decipher = createDecipheriv("aes-256-gcm", this.key(), Buffer.from(envelope.iv, "base64url"));
    decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));

    return Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      decipher.final()
    ]).toString("utf8");
  }

  private key(): Buffer {
    const encodedKey = this.configService.get("FIELD_ENCRYPTION_KEY_BASE64", { infer: true }) as string;

    return Buffer.from(encodedKey, "base64");
  }
}
