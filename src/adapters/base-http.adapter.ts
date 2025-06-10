import type { IHttpAdapter } from "../interfaces";

export abstract class BaseHttpAdapter implements IHttpAdapter {
  abstract getRequest(context: any): any;
  abstract getResponse(context: any): any;
  abstract getIp(request: any): string;
  abstract getUserAgent(request: any): string;
  abstract getPath(request: any): string;
  abstract getMethod(request: any): string;
  abstract getHeaders(request: any): Record<string, string>;
  abstract setHeaders(response: any, headers: Record<string, string>): void;
  abstract send(response: any, data: any, statusCode?: number): void;

  protected normalizeHeaders(headers: any): Record<string, string> {
    const normalized: Record<string, string> = {};

    if (!headers || typeof headers !== "object") {
      return normalized;
    }

    for (const [key, value] of Object.entries(headers)) {
      if (value !== undefined && value !== null) {
        normalized[key.toLowerCase()] = String(value);
      }
    }

    return normalized;
  }

  protected extractIpFromHeaders(headers: Record<string, string>): string | null {
    const ipHeaders = [
      "x-forwarded-for",
      "x-real-ip",
      "x-client-ip",
      "x-forwarded",
      "forwarded-for",
      "forwarded",
    ];

    for (const header of ipHeaders) {
      const value = headers[header];
      if (value) {
        const ip = value.split(",")[0].trim();
        if (this.isValidIp(ip)) {
          return ip;
        }
      }
    }

    return null;
  }

  protected isValidIp(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6Regex = /^([\da-f]{1,4}:){7}[\da-f]{1,4}$/i;

    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }
}
