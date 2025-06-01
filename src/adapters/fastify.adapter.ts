import { Injectable } from "@nestjs/common";
import { FastifyRequest, FastifyReply } from "fastify";
import { BaseHttpAdapter } from "./base-http.adapter";

@Injectable()
export class FastifyAdapter extends BaseHttpAdapter {
  getRequest(context: any): FastifyRequest {
    return context.switchToHttp().getRequest();
  }

  getResponse(context: any): FastifyReply {
    return context.switchToHttp().getResponse();
  }

  getIp(request: FastifyRequest): string {
    const headers = this.normalizeHeaders(request.headers);
    const headerIp = this.extractIpFromHeaders(headers);

    if (headerIp) {
      return headerIp;
    }

    const ip = request.ip || request.socket?.remoteAddress || "127.0.0.1";

    if (ip.startsWith("::ffff:")) {
      return ip.substring(7);
    }

    return ip;
  }

  getUserAgent(request: FastifyRequest): string {
    return request.headers["user-agent"] || "";
  }

  getPath(request: FastifyRequest): string {
    return request.url.split("?")[0] || "/";
  }

  getMethod(request: FastifyRequest): string {
    return request.method;
  }

  getHeaders(request: FastifyRequest): Record<string, string> {
    return this.normalizeHeaders(request.headers);
  }

  setHeaders(response: FastifyReply, headers: Record<string, string>): void {
    for (const [key, value] of Object.entries(headers)) {
      void response.header(key, value);
    }
  }

  send(response: FastifyReply, data: any, statusCode: number = 200): void {
    if (!response.sent) {
      void response.status(statusCode).send(data);
    }
  }

  getBody(request: FastifyRequest): any {
    return request.body;
  }

  getQuery(request: FastifyRequest): any {
    return request.query;
  }

  getParams(request: FastifyRequest): any {
    return request.params;
  }

  getCookies(request: FastifyRequest): Record<string, string> {
    const cookies: Record<string, string> = {};
    const cookieHeader = request.headers.cookie;

    if (cookieHeader) {
      cookieHeader.split(";").forEach((cookie) => {
        const [name, value] = cookie.trim().split("=");
        if (name && value) {
          cookies[name] = decodeURIComponent(value);
        }
      });
    }

    return cookies;
  }

  getProtocol(request: FastifyRequest): string {
    const proto = request.headers["x-forwarded-proto"];
    if (proto) {
      return Array.isArray(proto) ? proto[0] : proto;
    }
    return request.protocol || "http";
  }

  getHost(request: FastifyRequest): string {
    const host = request.headers["x-forwarded-host"] || request.headers.host;
    if (host) {
      return Array.isArray(host) ? host[0] : host;
    }
    return request.hostname || "localhost";
  }

  getUrl(request: FastifyRequest): string {
    const protocol = this.getProtocol(request);
    const host = this.getHost(request);
    const path = request.url || "/";
    return `${protocol}://${host}${path}`;
  }

  getRawRequest(request: FastifyRequest): any {
    return request.raw;
  }

  getRawResponse(response: FastifyReply): any {
    return response.raw;
  }
}
