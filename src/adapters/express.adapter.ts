import { Injectable } from "@nestjs/common";
import type { Response, Request } from "express";
import { BaseHttpAdapter } from "./base-http.adapter";

@Injectable()
export class ExpressAdapter extends BaseHttpAdapter {
  getRequest(context: any): Request {
    return context.switchToHttp().getRequest();
  }

  getResponse(context: any): Response {
    return context.switchToHttp().getResponse();
  }

  getIp(request: Request): string {
    const headers = this.normalizeHeaders(request.headers);
    const headerIp = this.extractIpFromHeaders(headers);

    if (headerIp) {
      return headerIp;
    }

    const ip =
      request.ip ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      "127.0.0.1";

    if (ip.startsWith("::ffff:")) {
      return ip.substring(7);
    }

    return ip;
  }

  getUserAgent(request: Request): string {
    return request.headers["user-agent"] || "";
  }

  getPath(request: Request): string {
    return request.path || request.url || "/";
  }

  getMethod(request: Request): string {
    return request.method;
  }

  getHeaders(request: Request): Record<string, string> {
    return this.normalizeHeaders(request.headers);
  }

  setHeaders(response: Response, headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
      response.setHeader(key, value);
    }
  }

  send(response: Response, data: any, statusCode: number = 200): void {
    if (!response.headersSent) {
      response.status(statusCode).json(data);
    }
  }

  getBody(request: Request): any {
    return request.body;
  }

  getQuery(request: Request): any {
    return request.query;
  }

  getParams(request: Request): any {
    return request.params;
  }

  getCookies(request: Request): Record<string, string> {
    return request.cookies || {};
  }

  getProtocol(request: Request): string {
    const proto = request.headers["x-forwarded-proto"];
    if (proto) {
      return Array.isArray(proto) ? proto[0] : proto;
    }
    return request.protocol || "http";
  }

  getHost(request: Request): string {
    const host = request.headers["x-forwarded-host"] || request.headers.host;
    if (host) {
      return Array.isArray(host) ? host[0] : host;
    }
    return request.hostname || "localhost";
  }

  getUrl(request: Request): string {
    const protocol = this.getProtocol(request);
    const host = this.getHost(request);
    const path = request.originalUrl || request.url || "/";
    return `${protocol}://${host}${path}`;
  }
}
