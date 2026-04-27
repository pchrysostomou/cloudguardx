import { Injectable } from "@nestjs/common";
import bcrypt from "bcryptjs";

const passwordHashCost = 12;

@Injectable()
export class PasswordService {
  hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, passwordHashCost);
  }

  verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(password, passwordHash);
  }
}

