import type { Request } from "express";

export interface RequestMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export function requestMetadataFrom(request: Request): RequestMetadata {
  const userAgent = request.headers["user-agent"];

  return {
    ipAddress: request.ip,
    userAgent: Array.isArray(userAgent) ? userAgent.join(", ") : userAgent
  };
}
